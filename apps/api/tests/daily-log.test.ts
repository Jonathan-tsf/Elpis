import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
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
  // TABLE_NAME stays set for the whole suite
});

function app() {
  return createApp({ version: '0', jwtVerifierStub: stubAccept });
}

function authHeader() {
  return { Authorization: 'Bearer good' };
}

const VALID_BODY = {
  mood: { mood: 7, energy: 8, focus: 6 },
  hydration_l: 2.5,
  notes: 'test note',
};

const DATE = '2026-05-12';

describe('PUT /daily-log/:date', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request(`/daily-log/${DATE}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid body and persists item', async () => {
    ddbMock.on(PutCommand as never).resolves({});
    const res = await app().request(`/daily-log/${DATE}`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe(DATE);
    expect(body.mood).toEqual(VALID_BODY.mood);
    expect(body.hydration_l).toBe(2.5);
    expect(body.notes).toBe('test note');
    expect(typeof body.updated_at).toBe('number');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(PutCommand as any);
    expect(calls).toHaveLength(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['TableName']).toBe('test');
    const item = input['Item'] as Record<string, unknown>;
    expect(item['pk']).toBe('USER#me');
    expect(item['sk']).toBe(`DAY#${DATE}`);
    expect(item['type']).toBe('DAILY_LOG');
  });

  it('returns 400 for invalid body (mood.mood = 99)', async () => {
    const res = await app().request(`/daily-log/${DATE}`, {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ mood: { mood: 99, energy: 5, focus: 5 } }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid body');
    expect(body.issues).toBeDefined();
  });

  it('returns 400 for malformed date in URL', async () => {
    const res = await app().request('/daily-log/not-a-date', {
      method: 'PUT',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid date');
  });
});

describe('GET /daily-log/:date', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request(`/daily-log/${DATE}`);
    expect(res.status).toBe(401);
  });

  it('returns 200 with the persisted item', async () => {
    const storedItem = {
      pk: 'USER#me',
      sk: `DAY#${DATE}`,
      type: 'DAILY_LOG',
      date: DATE,
      data: VALID_BODY,
      updated_at: 1234567890,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: storedItem } as any);
    const res = await app().request(`/daily-log/${DATE}`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.date).toBe(DATE);
    expect(body.mood).toEqual(VALID_BODY.mood);
    expect(body.updated_at).toBe(1234567890);
  });

  it('returns 404 when no item exists', async () => {
    ddbMock.on(GetCommand as never).resolves({});
    const res = await app().request(`/daily-log/${DATE}`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not found');
  });

  it('returns 400 for malformed date in URL', async () => {
    const res = await app().request('/daily-log/bad-date!!', {
      headers: authHeader(),
    });
    expect(res.status).toBe(400);
  });
});

describe('GET /daily-log', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/daily-log?from=2026-05-01&to=2026-05-12');
    expect(res.status).toBe(401);
  });

  it('returns sorted items within the date range', async () => {
    const items = [
      {
        pk: 'USER#me',
        sk: 'DAY#2026-05-10',
        type: 'DAILY_LOG',
        date: '2026-05-10',
        data: { notes: 'day 10' },
        updated_at: 100,
      },
      {
        pk: 'USER#me',
        sk: 'DAY#2026-05-05',
        type: 'DAILY_LOG',
        date: '2026-05-05',
        data: { notes: 'day 5' },
        updated_at: 50,
      },
      {
        pk: 'USER#me',
        sk: 'DAY#2026-04-01',
        type: 'DAILY_LOG',
        date: '2026-04-01',
        data: { notes: 'out of range' },
        updated_at: 10,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: items } as any);
    const res = await app().request('/daily-log?from=2026-05-01&to=2026-05-12', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.from).toBe('2026-05-01');
    expect(body.to).toBe('2026-05-12');
    expect(body.items).toHaveLength(2);
    expect(body.items[0].date).toBe('2026-05-05');
    expect(body.items[1].date).toBe('2026-05-10');
    // out-of-range item excluded
    expect(body.items.find((i: { date: string }) => i.date === '2026-04-01')).toBeUndefined();
  });

  it('returns 400 for invalid from/to query params', async () => {
    const res = await app().request('/daily-log?from=bad&to=2026-05-12', {
      headers: authHeader(),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid date range');
  });
});
