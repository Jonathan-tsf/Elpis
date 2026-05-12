import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { TranscribeClient, StartTranscriptionJobCommand, GetTranscriptionJobCommand } from '@aws-sdk/client-transcribe';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

// Stub presigner
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://s3.example.com/presigned-url'),
}));

// Stub Bedrock (voice-parser calls Claude)
vi.mock('../src/services/bedrock-client', () => ({
  invokeClaude: vi.fn(),
  runWithTools: vi.fn().mockResolvedValue({
    finalText: 'Terminé',
    allMessages: [],
    usage: { input_tokens: 10, output_tokens: 5 },
  }),
}));

beforeAll(() => {
  process.env['TABLE_NAME'] = 'test';
  process.env['VOICE_BUCKET'] = 'test-voice-bucket';
  process.env['PHOTOS_BUCKET'] = 'test-photos-bucket';
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const transcribeMock = mockClient(TranscribeClient as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s3Mock = mockClient(S3Client as any);

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };

beforeEach(() => {
  ddbMock.reset();
  transcribeMock.reset();
  s3Mock.reset();
});

afterEach(() => {
  vi.clearAllMocks();
});

function app() {
  return createApp({ version: '0', jwtVerifierStub: stubAccept });
}

function authHeader() {
  return { Authorization: 'Bearer good' };
}

// ─── POST /voice-journal/presign ─────────────────────────────────────────────

describe('POST /voice-journal/presign', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/voice-journal/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'audio/webm' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    const res = await app().request('/voice-journal/presign', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });

  it('returns key + uploadUrl for valid request', async () => {
    const res = await app().request('/voice-journal/presign', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'audio/webm' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { key: string; uploadUrl: string };
    expect(typeof body.key).toBe('string');
    expect(body.key).toMatch(/^audio\//);
    expect(body.uploadUrl).toBe('https://s3.example.com/presigned-url');
  });
});

// ─── POST /voice-journal/start ───────────────────────────────────────────────

describe('POST /voice-journal/start', () => {
  it('returns 401 without Authorization', async () => {
    const res = await app().request('/voice-journal/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'audio/2026-05-12/test.webm', date: '2026-05-12' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    const res = await app().request('/voice-journal/start', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'audio/test.webm' }), // missing date
    });
    expect(res.status).toBe(400);
  });

  it('starts transcription job and persists VOICE_JOB in DynamoDB', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    transcribeMock.on(StartTranscriptionJobCommand as never).resolves({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/voice-journal/start', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'audio/2026-05-12/test.webm', date: '2026-05-12' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { jobName: string; date: string; status: string };
    expect(body.status).toBe('transcribing');
    expect(body.date).toBe('2026-05-12');
    expect(typeof body.jobName).toBe('string');
    expect(body.jobName).toMatch(/^lifeos-voice-2026-05-12/);

    // DynamoDB PutCommand should have been called
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const putCalls = ddbMock.commandCalls(PutCommand as never);
    expect(putCalls.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── GET /voice-journal/:date/status ─────────────────────────────────────────

describe('GET /voice-journal/:date/status', () => {
  it('returns 401 without Authorization', async () => {
    const res = await app().request('/voice-journal/2026-05-12/status');
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid date format', async () => {
    const res = await app().request('/voice-journal/not-a-date/status', {
      headers: authHeader(),
    });
    expect(res.status).toBe(400);
  });

  it('returns 404 when no VOICE_JOB item exists', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({} as any);
    const res = await app().request('/voice-journal/2026-05-12/status', {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('none');
  });

  it('returns transcribing status when Transcribe job is IN_PROGRESS', async () => {
    const storedItem = {
      PK: 'USER#me',
      SK: 'VOICE_JOB#2026-05-12',
      type: 'VOICE_JOB',
      date: '2026-05-12',
      jobName: 'lifeos-voice-2026-05-12-123',
      s3Key: 'audio/2026-05-12/test.webm',
      status: 'transcribing',
      updated_at: Date.now(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: storedItem } as any);
    transcribeMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(GetTranscriptionJobCommand as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'lifeos-voice-2026-05-12-123',
          TranscriptionJobStatus: 'IN_PROGRESS',
        },
      } as any);

    const res = await app().request('/voice-journal/2026-05-12/status', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('transcribing');
  });

  it('returns ready status when Transcribe COMPLETED and Claude parses transcript', async () => {
    const storedItem = {
      PK: 'USER#me',
      SK: 'VOICE_JOB#2026-05-12',
      type: 'VOICE_JOB',
      date: '2026-05-12',
      jobName: 'lifeos-voice-2026-05-12-999',
      s3Key: 'audio/2026-05-12/test.webm',
      status: 'transcribing',
      updated_at: Date.now(),
    };
    // DynamoDB: GetCommand returns item (any call)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: storedItem } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    // Transcribe COMPLETED
    transcribeMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(GetTranscriptionJobCommand as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({
        TranscriptionJob: {
          TranscriptionJobName: 'lifeos-voice-2026-05-12-999',
          TranscriptionJobStatus: 'COMPLETED',
          Transcript: {
            TranscriptFileUri:
              'https://s3.us-east-1.amazonaws.com/test-voice-bucket/transcripts/lifeos-voice-2026-05-12-999.json',
          },
        },
      } as any);

    // S3 returns transcript JSON
    const transcriptJson = JSON.stringify({
      results: { transcripts: [{ transcript: "J'ai bien dormi 8h ce soir." }] },
    });
    const mockBody = {
      transformToString: async () => transcriptJson,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s3Mock.on(GetObjectCommand as never).resolves({ Body: mockBody } as any);

    // runWithTools (voice-parser) is already mocked to return empty draft
    const res = await app().request('/voice-journal/2026-05-12/status', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string; draft: unknown; transcript: string };
    expect(body.status).toBe('ready');
    expect(body.transcript).toContain("J'ai bien dormi");
    expect(body.draft).toBeDefined();
  });

  it('returns already-ready item directly without re-checking Transcribe', async () => {
    const readyItem = {
      PK: 'USER#me',
      SK: 'VOICE_JOB#2026-05-12',
      type: 'VOICE_JOB',
      date: '2026-05-12',
      jobName: 'lifeos-voice-2026-05-12-888',
      s3Key: 'audio/2026-05-12/test.webm',
      status: 'ready',
      transcript: 'some text',
      draft: { daily_log_draft: {} },
      updated_at: Date.now(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: readyItem } as any);

    const res = await app().request('/voice-journal/2026-05-12/status', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { status: string };
    expect(body.status).toBe('ready');
    // Transcribe should NOT be called since status is already ready
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(transcribeMock.commandCalls(GetTranscriptionJobCommand as never)).toHaveLength(0);
  });
});
