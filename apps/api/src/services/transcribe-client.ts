import {
  TranscribeClient,
  StartTranscriptionJobCommand,
  GetTranscriptionJobCommand,
} from '@aws-sdk/client-transcribe';

let _client: TranscribeClient | undefined;
export function getTranscribeClient(): TranscribeClient {
  if (!_client)
    _client = new TranscribeClient({ region: process.env['AWS_REGION'] ?? 'us-east-1' });
  return _client;
}

export function voiceBucket(): string {
  const b = process.env['VOICE_BUCKET'];
  if (!b) throw new Error('VOICE_BUCKET env var not set');
  return b;
}

export async function startTranscriptionJob(
  jobName: string,
  s3Uri: string,
  languageCode = 'fr-FR',
): Promise<void> {
  await getTranscribeClient().send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      LanguageCode: languageCode as import('@aws-sdk/client-transcribe').LanguageCode,
      Media: { MediaFileUri: s3Uri },
      OutputBucketName: voiceBucket(),
      OutputKey: `transcripts/${jobName}.json`,
    }),
  );
}

export async function getTranscriptionJob(jobName: string) {
  const res = await getTranscribeClient().send(
    new GetTranscriptionJobCommand({ TranscriptionJobName: jobName }),
  );
  return res.TranscriptionJob;
}
