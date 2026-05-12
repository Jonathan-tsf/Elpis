import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
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
  metric: 'weight',
  value: 75.5,
  date: '2026-05-10',
};

describe('POST /measurements', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/measurements', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid body', async () => {
    ddbMock.on(PutCommand as never).resolves({});

    const res = await app().request('/measurements', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.metric).toBe('weight');
    expect(body.value).toBe(75.5);
    expect(body.date).toBe('2026-05-10');
    expect(typeof body.created_at).toBe('number');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(PutCommand as any);
    expect(calls.length).toBeGreaterThanOrEqual(1);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    const item = input['Item'] as Record<string, unknown>;
    expect(item['PK']).toBe('USER#me');
    expect((item['SK'] as string).startsWith('MEAS#weight#')).toBe(true);
    expect(item['type']).toBe('MEASUREMENT');
  });

  it('returns 400 for invalid metric', async () => {
    const res = await app().request('/measurements', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, metric: 'not_a_real_metric' }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid body');
  });

  it('returns 400 for negative value', async () => {
    const res = await app().request('/measurements', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, value: -1 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid body');
  });
});

describe('GET /measurements/:metric', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/measurements/weight');
    expect(res.status).toBe(401);
  });

  it('returns items sorted by date ascending', async () => {
    const items = [
      {
        PK: 'USER#me',
        SK: 'MEAS#weight#2026-05-10',
        type: 'MEASUREMENT',
        data: { metric: 'weight', value: 75.5, date: '2026-05-10' },
        created_at: 200,
      },
      {
        PK: 'USER#me',
        SK: 'MEAS#weight#2026-05-05',
        type: 'MEASUREMENT',
        data: { metric: 'weight', value: 76.0, date: '2026-05-05' },
        created_at: 100,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: items } as any);

    const res = await app().request('/measurements/weight?from=2026-05-01&to=2026-05-12', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.items).toHaveLength(2);
    expect(body.items[0].date).toBe('2026-05-05');
    expect(body.items[0].value).toBe(76.0);
    expect(body.items[1].date).toBe('2026-05-10');
    expect(body.items[1].value).toBe(75.5);
  });
});

describe('GET /measurements', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/measurements');
    expect(res.status).toBe(401);
  });

  it('returns latest measurement per metric', async () => {
    const items = [
      {
        PK: 'USER#me',
        SK: 'MEAS#weight#2026-05-10',
        type: 'MEASUREMENT',
        data: { metric: 'weight', value: 75.5, date: '2026-05-10' },
        created_at: 200,
      },
      {
        PK: 'USER#me',
        SK: 'MEAS#weight#2026-05-05',
        type: 'MEASUREMENT',
        data: { metric: 'weight', value: 76.0, date: '2026-05-05' },
        created_at: 100,
      },
      {
        PK: 'USER#me',
        SK: 'MEAS#waist#2026-05-08',
        type: 'MEASUREMENT',
        data: { metric: 'waist', value: 80.0, date: '2026-05-08' },
        created_at: 150,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: items } as any);

    const res = await app().request('/measurements', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.latest).toBe('object');
    // Should keep most recent weight (2026-05-10, 75.5), not the earlier one
    expect(body.latest.weight).toEqual({ date: '2026-05-10', value: 75.5 });
    expect(body.latest.waist).toEqual({ date: '2026-05-08', value: 80.0 });
  });
});
