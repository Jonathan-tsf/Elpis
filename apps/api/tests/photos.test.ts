import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { createApp } from '../src/app';

// Stub the S3 presigner so we don't need a real AWS connection
vi.mock('@aws-sdk/s3-request-presigner', () => ({
  getSignedUrl: vi.fn().mockResolvedValue('https://example.com/upload-url'),
}));

// Also stub PHOTOS_BUCKET env
beforeAll(() => {
  process.env['TABLE_NAME'] = 'test';
  process.env['PHOTOS_BUCKET'] = 'test-bucket';
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };

beforeEach(() => {
  ddbMock.reset();
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

const VALID_CONFIRM_BODY = {
  photoId: 'photo-abc-123',
  key: 'photos/2026-05-12/photo-abc-123.jpg',
  date: '2026-05-12',
  tags: ['face'],
};

describe('POST /photos/presign', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/photos/presign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'image/jpeg' }),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid body and correct shape', async () => {
    const res = await app().request('/photos/presign', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: 'image/jpeg' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.photoId).toBe('string');
    expect(typeof body.key).toBe('string');
    expect(body.key.startsWith('photos/')).toBe(true);
    expect(body.key.endsWith('.jpg')).toBe(true);
    expect(body.uploadUrl).toBe('https://example.com/upload-url');
  });

  it('returns 400 for empty contentType', async () => {
    const res = await app().request('/photos/presign', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ contentType: '' }),
    });
    expect(res.status).toBe(400);
  });
});

describe('POST /photos', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_CONFIRM_BODY),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200, persists Photo item with correct PK/SK', async () => {
    ddbMock.on(GetCommand as never).resolves({});
    ddbMock.on(PutCommand as never).resolves({});

    const res = await app().request('/photos', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_CONFIRM_BODY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(VALID_CONFIRM_BODY.photoId);
    expect(body.date).toBe(VALID_CONFIRM_BODY.date);
    expect(body.s3_key).toBe(VALID_CONFIRM_BODY.key);
    expect(body.tags).toEqual(['face']);
    expect(typeof body.created_at).toBe('number');
    expect(Array.isArray(body.xp_deltas)).toBe(true);
    expect(body.xp_deltas.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.stats).toBe('object');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(PutCommand as any);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    const item = input['Item'] as Record<string, unknown>;
    expect(item['PK']).toBe('USER#me');
    expect(typeof item['SK']).toBe('string');
    expect((item['SK'] as string).startsWith('PHOTO#')).toBe(true);
    expect(item['type']).toBe('PHOTO');
  });

  it('returns 400 with no tags (empty array)', async () => {
    const res = await app().request('/photos', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_CONFIRM_BODY, tags: [] }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid body');
  });

  it('returns 400 without tags field', async () => {
    const { tags: _tags, ...noTags } = VALID_CONFIRM_BODY;
    const res = await app().request('/photos', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(noTags),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /photos', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/photos');
    expect(res.status).toBe(401);
  });

  it('returns items', async () => {
    const photoItem = {
      PK: 'USER#me',
      SK: 'PHOTO#2026-05-12#photo-abc-123',
      type: 'PHOTO',
      id: 'photo-abc-123',
      date: '2026-05-12',
      s3_key: 'photos/2026-05-12/photo-abc-123.jpg',
      tags: ['face'],
      created_at: 1234567890,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [photoItem] } as any);

    const res = await app().request('/photos', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.items).toHaveLength(1);
    expect(body.items[0].id).toBe('photo-abc-123');
    expect(body.items[0].tags).toEqual(['face']);
  });
});

describe('GET /photos/:id/url', () => {
  it('returns URL when item exists', async () => {
    const photoItem = {
      PK: 'USER#me',
      SK: 'PHOTO#2026-05-12#photo-abc-123',
      type: 'PHOTO',
      id: 'photo-abc-123',
      date: '2026-05-12',
      s3_key: 'photos/2026-05-12/photo-abc-123.jpg',
      tags: ['face'],
      created_at: 1234567890,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [photoItem] } as any);

    const res = await app().request('/photos/photo-abc-123/url', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.url).toBe('string');
    expect(body.url).toBe('https://example.com/upload-url');
  });

  it('returns 404 when photo not found', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/photos/nonexistent-id/url', { headers: authHeader() });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not found');
  });

  it('returns 401 without auth', async () => {
    const res = await app().request('/photos/some-id/url');
    expect(res.status).toBe(401);
  });
});
