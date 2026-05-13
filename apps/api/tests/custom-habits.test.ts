import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand, GetCommand, QueryCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../src/app';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);

const stubAccept = { verify: async (t: string) => (t === 'good' ? { sub: 'user-123' } : null) };

beforeAll(() => {
  process.env['TABLE_NAME'] = 'test';
});

beforeEach(() => {
  ddbMock.reset();
});

afterEach(() => {
  // TABLE_NAME stays set
});

function app() {
  return createApp({ version: '0', jwtVerifierStub: stubAccept });
}

function authHeader() {
  return { Authorization: 'Bearer good' };
}

const VALID_HABIT = {
  name: 'Méditation',
  icon: '🧘',
  frequency: 'daily',
  measurement: 'boolean',
};

const VALID_LOG = {
  habit_id: 'habit-123',
  date: '2026-05-11',
  done: true,
};

// ── POST /habits ─────────────────────────────────────────────────────────────

describe('POST /habits', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_HABIT),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await app().request('/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name: '', frequency: 'daily', measurement: 'boolean' }),
    });
    expect(res.status).toBe(400);
  });

  it('creates a habit successfully', async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await app().request('/habits', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(VALID_HABIT),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as Record<string, unknown>;
    expect(body.id).toBeDefined();
    expect(body.name).toBe('Méditation');
    expect(body.archived).toBe(false);
  });
});

// ── GET /habits ───────────────────────────────────────────────────────────────

describe('GET /habits', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns list of non-archived habits', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { PK: 'USER#me', SK: 'HABIT#abc', type: 'CUSTOM_HABIT', id: 'abc', name: 'Test', frequency: 'daily', measurement: 'boolean', archived: false, created_at: 1000 },
        { PK: 'USER#me', SK: 'HABIT#def', type: 'CUSTOM_HABIT', id: 'def', name: 'Archived', frequency: 'daily', measurement: 'boolean', archived: true, created_at: 999 },
      ],
    });
    const res = await app().request('/habits', {
      method: 'GET',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

// ── PATCH /habits/:id ─────────────────────────────────────────────────────────

describe('PATCH /habits/:id', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits/abc', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ name: 'Updated' }) });
    expect(res.status).toBe(401);
  });

  it('returns 404 when habit does not exist', async () => {
    ddbMock.on(GetCommand).resolves({ Item: undefined });
    const res = await app().request('/habits/nonexistent', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name: 'Updated' }),
    });
    expect(res.status).toBe(404);
  });

  it('updates a habit successfully', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { PK: 'USER#me', SK: 'HABIT#abc', type: 'CUSTOM_HABIT', id: 'abc', name: 'Old', frequency: 'daily', measurement: 'boolean', archived: false, created_at: 1000 },
    });
    ddbMock.on(PutCommand).resolves({});
    const res = await app().request('/habits/abc', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ name: 'Updated Name' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { name: string };
    expect(body.name).toBe('Updated Name');
  });
});

// ── DELETE /habits/:id ────────────────────────────────────────────────────────

describe('DELETE /habits/:id', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits/abc', { method: 'DELETE' });
    expect(res.status).toBe(401);
  });

  it('archives the habit', async () => {
    ddbMock.on(GetCommand).resolves({
      Item: { PK: 'USER#me', SK: 'HABIT#abc', type: 'CUSTOM_HABIT', id: 'abc', name: 'Test', frequency: 'daily', measurement: 'boolean', archived: false, created_at: 1000 },
    });
    ddbMock.on(PutCommand).resolves({});
    const res = await app().request('/habits/abc', {
      method: 'DELETE',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { archived: boolean };
    expect(body.archived).toBe(true);
  });
});

// ── POST /habits/logs ─────────────────────────────────────────────────────────

describe('POST /habits/logs', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_LOG),
    });
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await app().request('/habits/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ habit_id: '', date: 'not-a-date' }),
    });
    expect(res.status).toBe(400);
  });

  it('creates a habit log successfully', async () => {
    ddbMock.on(PutCommand).resolves({});
    const res = await app().request('/habits/logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify(VALID_LOG),
    });
    expect(res.status).toBe(201);
    const body = await res.json() as { habit_id: string; done: boolean };
    expect(body.habit_id).toBe('habit-123');
    expect(body.done).toBe(true);
  });
});

// ── GET /habits/logs ──────────────────────────────────────────────────────────

describe('GET /habits/logs', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits/logs?habit_id=abc', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns logs filtered by habit_id', async () => {
    ddbMock.on(QueryCommand).resolves({
      Items: [
        { PK: 'USER#me', SK: 'HLOG#habit-123#2026-05-11', type: 'HABIT_LOG', habit_id: 'habit-123', date: '2026-05-11', done: true, created_at: 1000 },
      ],
    });
    const res = await app().request('/habits/logs?habit_id=habit-123', {
      method: 'GET',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { items: unknown[] };
    expect(body.items).toHaveLength(1);
  });
});

// ── GET /habits/logs/today ────────────────────────────────────────────────────

describe('GET /habits/logs/today', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/habits/logs/today', { method: 'GET' });
    expect(res.status).toBe(401);
  });

  it('returns today logs joined with habit metadata', async () => {
    ddbMock.on(QueryCommand)
      .resolvesOnce({
        Items: [
          { PK: 'USER#me', SK: 'HABIT#abc', type: 'CUSTOM_HABIT', id: 'abc', name: 'Méditation', frequency: 'daily', measurement: 'boolean', archived: false, created_at: 1000 },
        ],
      })
      .resolvesOnce({ Items: [] });
    const res = await app().request('/habits/logs/today', {
      method: 'GET',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json() as { items: Array<{ habit: { name: string }; log: null }> };
    expect(body.items).toHaveLength(1);
    expect(body.items[0]!.habit.name).toBe('Méditation');
    expect(body.items[0]!.log).toBeNull();
  });
});
