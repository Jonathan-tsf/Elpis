import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
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

function app() {
  return createApp({ version: '0', jwtVerifierStub: stubAccept });
}

function authHeader() {
  return { Authorization: 'Bearer good' };
}

const FAKE_STATS = {
  global_level: 1,
  global_xp: 50,
  per_stat: {
    force: { level: 1, xp: 0, xp_to_next: 200 },
    endurance: { level: 1, xp: 0, xp_to_next: 200 },
    vitality: { level: 1, xp: 30, xp_to_next: 170 },
    discipline: { level: 1, xp: 20, xp_to_next: 180 },
    appearance: { level: 1, xp: 0, xp_to_next: 200 },
    spirit: { level: 1, xp: 0, xp_to_next: 200 },
  },
  updated_at: 1234567890,
};

describe('GET /stats', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/stats');
    expect(res.status).toBe(401);
  });

  it('returns stats and recent_events', async () => {
    const statsItem = {
      PK: 'USER#me',
      SK: 'STATS',
      type: 'STATS',
      stats: FAKE_STATS,
    };
    const xpEvent = {
      PK: 'USER#me',
      SK: 'XP#1234567890#event-1',
      id: 'event-1',
      ts: 1234567890,
      source: 'daily_log:2026-05-12',
      amount: 20,
      stat: 'discipline',
      reason: 'daily_log_saved',
    };

    ddbMock
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(GetCommand as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({ Item: statsItem } as any)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .on(QueryCommand as never)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .resolves({ Items: [xpEvent] } as any);

    const res = await app().request('/stats', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeDefined();
    expect(body.stats.global_level).toBe(1);
    expect(body.stats.global_xp).toBe(50);
    expect(Array.isArray(body.recent_events)).toBe(true);
    expect(body.recent_events).toHaveLength(1);
    expect(body.recent_events[0].stat).toBe('discipline');
  });

  it('returns null stats when no stats stored yet', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({} as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/stats', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.stats).toBeNull();
    expect(body.recent_events).toEqual([]);
  });
});
