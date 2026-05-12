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
  date: '2026-05-10',
  type: 'push',
  duration_min: 60,
  rpe: 7,
  exercises: [
    {
      name: 'Bench Press',
      sets: [
        { reps: 8, weight_kg: 80 },
        { reps: 8, weight_kg: 80 },
        { reps: 6, weight_kg: 85 },
      ],
    },
  ],
};

describe('POST /workouts', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/workouts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(401);
  });

  it('returns 200 with valid body, persists item with correct keys', async () => {
    ddbMock.on(GetCommand as never).resolves({});
    ddbMock.on(PutCommand as never).resolves({});

    const res = await app().request('/workouts', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify(VALID_BODY),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(body.date).toBe(VALID_BODY.date);
    expect(body.type).toBe('push');
    expect(typeof body.created_at).toBe('number');
    expect(Array.isArray(body.xp_deltas)).toBe(true);
    expect(body.xp_deltas.length).toBeGreaterThanOrEqual(1);
    expect(typeof body.stats).toBe('object');
    expect(typeof body.stats.global_level).toBe('number');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(PutCommand as any);
    expect(calls.length).toBeGreaterThanOrEqual(2);
    const input = calls[0]?.args[0].input as Record<string, unknown>;
    expect(input['TableName']).toBe('test');
    const item = input['Item'] as Record<string, unknown>;
    expect(item['PK']).toBe('USER#me');
    expect(typeof item['SK']).toBe('string');
    expect((item['SK'] as string).startsWith('WORKOUT#')).toBe(true);
    expect(item['type']).toBe('WORKOUT');
  });

  it('returns 400 for invalid body (sets > 20)', async () => {
    const tooManySets = Array.from({ length: 21 }, (_, i) => ({ reps: i + 1 }));
    const res = await app().request('/workouts', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...VALID_BODY,
        exercises: [{ name: 'Squat', sets: tooManySets }],
      }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid body');
  });

  it('returns 400 for rpe > 10', async () => {
    const res = await app().request('/workouts', {
      method: 'POST',
      headers: { ...authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...VALID_BODY, rpe: 11 }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('invalid body');
  });
});

describe('GET /workouts/:id', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/workouts/some-id');
    expect(res.status).toBe(401);
  });

  it('returns 200 when item is found', async () => {
    const targetId = 'abc-123';
    const workoutItem = {
      PK: 'USER#me',
      SK: `WORKOUT#2026-05-10#${targetId}`,
      type: 'WORKOUT',
      id: targetId,
      data: VALID_BODY,
      created_at: 1234567890,
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [workoutItem] } as any);

    const res = await app().request(`/workouts/${targetId}`, {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(targetId);
    expect(body.date).toBe(VALID_BODY.date);
    expect(body.type).toBe('push');
    expect(body.created_at).toBe(1234567890);
  });

  it('returns 404 when no item matches the id', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/workouts/nonexistent-id', {
      headers: authHeader(),
    });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error).toBe('not found');
  });
});

describe('GET /workouts', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/workouts?from=2026-05-01&to=2026-05-12');
    expect(res.status).toBe(401);
  });

  it('returns workouts in range sorted ascending', async () => {
    const items = [
      {
        PK: 'USER#me',
        SK: 'WORKOUT#2026-05-10#id1',
        type: 'WORKOUT',
        id: 'id1',
        data: { ...VALID_BODY, date: '2026-05-10' },
        created_at: 200,
      },
      {
        PK: 'USER#me',
        SK: 'WORKOUT#2026-05-05#id2',
        type: 'WORKOUT',
        id: 'id2',
        data: { ...VALID_BODY, date: '2026-05-05' },
        created_at: 100,
      },
      {
        PK: 'USER#me',
        SK: 'WORKOUT#2026-04-01#id3',
        type: 'WORKOUT',
        id: 'id3',
        data: { ...VALID_BODY, date: '2026-04-01' },
        created_at: 10,
      },
    ];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: items } as any);

    const res = await app().request('/workouts?from=2026-05-01&to=2026-05-12', {
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.from).toBe('2026-05-01');
    expect(body.to).toBe('2026-05-12');
    expect(body.items).toHaveLength(2);
    expect(body.items[0].date).toBe('2026-05-05');
    expect(body.items[1].date).toBe('2026-05-10');
    expect(body.items.find((i: { date: string }) => i.date === '2026-04-01')).toBeUndefined();
  });
});
