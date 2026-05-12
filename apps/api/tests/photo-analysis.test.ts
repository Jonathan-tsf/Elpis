import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';
import { Readable } from 'stream';

vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/signed-url'),
}));

vi.mock('../src/services/bedrock-client', () => ({
  invokeClaude: vi.fn().mockResolvedValue({
    content: [{ type: 'text', text: '## Analyse\n\nBonne structure osseuse. Améliorations: 1. Soins peau 2. Sourire 3. Coupe de cheveux.' }],
    stop_reason: 'end_turn',
    usage: { input_tokens: 100, output_tokens: 50 },
  }),
  getBedrockRuntime: vi.fn(),
}));

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const s3Mock = mockClient(S3Client as any);

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };

beforeAll(() => {
  process.env['TABLE_NAME'] = 'test';
  process.env['PHOTOS_BUCKET'] = 'test-bucket';
});

beforeEach(() => {
  ddbMock.reset();
  s3Mock.reset();
  vi.clearAllMocks();
});

function app() {
  return createApp({ version: '0', jwtVerifierStub: stubAccept });
}

function authHeader() {
  return { Authorization: 'Bearer good' };
}

const PHOTO_ITEM = {
  PK: 'USER#me',
  SK: 'PHOTO#2026-05-01#photo-xyz',
  type: 'PHOTO',
  id: 'photo-xyz',
  date: '2026-05-01',
  s3_key: 'photos/2026-05-01/photo-xyz.jpg',
  tags: ['face'],
  created_at: 1000,
};

describe('POST /photos/:id/analyze', () => {
  it('returns 401 without auth', async () => {
    const res = await app().request('/photos/photo-xyz/analyze', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('returns 404 if photo not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/photos/nonexistent/analyze', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'face' }),
    });
    expect(res.status).toBe(404);
  });

  it('returns analysis when photo exists and Claude responds', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [PHOTO_ITEM] } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    // Mock S3 GetObject to return a small image buffer
    const imageBuffer = Buffer.from('fake-image-data');
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    s3Mock.on(GetObjectCommand as never).resolves({
      Body: Readable.from([imageBuffer]),
      ContentType: 'image/jpeg',
    } as any);

    const res = await app().request('/photos/photo-xyz/analyze', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ scope: 'face' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(body.photo_id).toBe('photo-xyz');
    expect(typeof body.markdown).toBe('string');
    expect(body.markdown.length).toBeGreaterThan(0);
    expect(body.scope).toBe('face');
    expect(typeof body.created_at).toBe('number');

    // Verify analysis was persisted
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puts = ddbMock.commandCalls(PutCommand as any);
    expect(puts.length).toBeGreaterThanOrEqual(1);
    const item = puts[0]?.args[0].input['Item'] as Record<string, unknown>;
    expect((item['SK'] as string).startsWith('PHOTOAN#')).toBe(true);
    expect(item['type']).toBe('PHOTO_ANALYSIS');
  });
});

describe('GET /photos/:id/analyses', () => {
  it('returns 401 without auth', async () => {
    const res = await app().request('/photos/photo-xyz/analyses');
    expect(res.status).toBe(401);
  });

  it('returns list of analyses for a photo', async () => {
    const analysisItem = {
      PK: 'USER#me',
      SK: 'PHOTOAN#2026-05-01#an-1',
      type: 'PHOTO_ANALYSIS',
      id: 'an-1',
      photo_id: 'photo-xyz',
      date: '2026-05-01',
      scope: 'face',
      markdown: '## Test',
      model: 'test-model',
      created_at: 2000,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [analysisItem] } as any);

    const res = await app().request('/photos/photo-xyz/analyses', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.analyses)).toBe(true);
    expect(body.analyses).toHaveLength(1);
    expect(body.analyses[0].photo_id).toBe('photo-xyz');
  });
});
