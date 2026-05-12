import { Hono } from 'hono';
import { z } from 'zod';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getS3Client } from '../services/s3-client';
import {
  voiceBucket,
  startTranscriptionJob,
  getTranscriptionJob,
} from '../services/transcribe-client';
import { getDocClient, putItem, getItem } from '../services/dynamodb-client';
import { USER_PK, dateString } from '../services/keys';
import { parseTranscript } from '../services/voice-parser';

type VoiceJobItem = {
  PK: string;
  SK: string; // VOICE_JOB#<date>
  type: 'VOICE_JOB';
  date: string;
  jobName: string;
  s3Key: string;
  status: 'uploaded' | 'transcribing' | 'parsing' | 'ready' | 'error';
  transcript?: string;
  draft?: unknown;
  error?: string;
  updated_at: number;
};

const PresignInput = z.object({ contentType: z.string().min(1) });
const StartInput = z.object({
  key: z.string().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export function voiceJournalRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // POST /voice-journal/presign — get a presigned S3 PUT URL
  app.post('/presign', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = PresignInput.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    const key = `audio/${dateString()}/${crypto.randomUUID()}.webm`;
    const url = await getSignedUrl(
      getS3Client(),
      new PutObjectCommand({
        Bucket: voiceBucket(),
        Key: key,
        ContentType: parsed.data.contentType,
      }),
      { expiresIn: 300 },
    );
    return c.json({ key, uploadUrl: url });
  });

  // POST /voice-journal/start — start a Transcribe job and persist VOICE_JOB item
  app.post('/start', async (c) => {
    const body = await c.req.json().catch(() => null);
    const parsed = StartInput.safeParse(body);
    if (!parsed.success) return c.json({ error: 'invalid body' }, 400);
    const { key, date } = parsed.data;

    const jobName = `lifeos-voice-${date}-${Date.now()}`;
    const s3Uri = `s3://${voiceBucket()}/${key}`;
    await startTranscriptionJob(jobName, s3Uri);

    const item: VoiceJobItem = {
      PK: USER_PK,
      SK: `VOICE_JOB#${date}`,
      type: 'VOICE_JOB',
      date,
      jobName,
      s3Key: key,
      status: 'transcribing',
      updated_at: Date.now(),
    };
    await putItem(getDocClient(), item);
    return c.json({ jobName, date, status: 'transcribing' });
  });

  // GET /voice-journal/:date/status — poll status; on COMPLETED fetch + parse transcript
  app.get('/:date/status', async (c) => {
    const date = c.req.param('date');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return c.json({ error: 'invalid date' }, 400);
    const doc = getDocClient();
    const item = await getItem<VoiceJobItem>(doc, USER_PK, `VOICE_JOB#${date}`);
    if (!item) return c.json({ status: 'none' }, 404);
    if (item.status === 'ready' || item.status === 'error') return c.json(item);

    // Check Transcribe job status
    const job = await getTranscriptionJob(item.jobName);
    if (!job) return c.json({ ...item, status: 'transcribing' });
    const status = job.TranscriptionJobStatus;
    if (status === 'IN_PROGRESS' || status === 'QUEUED') {
      return c.json({ ...item, status: 'transcribing' });
    }
    if (status === 'FAILED') {
      const updated: VoiceJobItem = {
        ...item,
        status: 'error',
        error: job.FailureReason ?? 'transcribe_failed',
        updated_at: Date.now(),
      };
      await putItem(doc, updated);
      return c.json(updated);
    }
    if (status === 'COMPLETED') {
      const transcriptUri = job.Transcript?.TranscriptFileUri;
      if (!transcriptUri) {
        const updated: VoiceJobItem = {
          ...item,
          status: 'error',
          error: 'no_transcript_uri',
          updated_at: Date.now(),
        };
        await putItem(doc, updated);
        return c.json(updated);
      }
      const transcriptText = await fetchTranscriptText(transcriptUri);
      // Mark as parsing while we call Claude
      const inProgress: VoiceJobItem = {
        ...item,
        status: 'parsing',
        transcript: transcriptText,
        updated_at: Date.now(),
      };
      await putItem(doc, inProgress);
      const draft = await parseTranscript(transcriptText);
      const final: VoiceJobItem = {
        ...item,
        status: 'ready',
        transcript: transcriptText,
        draft,
        updated_at: Date.now(),
      };
      await putItem(doc, final);
      return c.json(final);
    }
    return c.json({ ...item, status: 'transcribing' });
  });

  return app;
}

async function fetchTranscriptText(uri: string): Promise<string> {
  // Transcribe with OutputBucketName returns a URI in the form:
  // https://s3.<region>.amazonaws.com/<bucket>/<key>
  // The Lambda has s3:GetObject on the voice bucket.
  const url = new URL(uri);
  const parts = url.pathname.replace(/^\//, '').split('/');
  const bucket = parts[0];
  const key = parts.slice(1).join('/');
  if (!bucket || !key) throw new Error('cannot parse transcript URI');

  const res = await getS3Client().send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = await res.Body?.transformToString();
  if (!body) throw new Error('empty transcript body');
  const json = JSON.parse(body) as {
    results?: { transcripts?: { transcript: string }[] };
  };
  return json.results?.transcripts?.[0]?.transcript ?? '';
}
