import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, QueryCommand } from '@aws-sdk/lib-dynamodb';
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

describe('GET /streaks', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/streaks');
    expect(res.status).toBe(401);
  });

  it('returns 3 streak categories computed from daily logs', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const yesterday = new Date(Date.now() - 86400_000).toISOString().slice(0, 10);

    const logItems = [
      {
        PK: 'USER#me',
        SK: `DAY#${yesterday}`,
        type: 'DAILY_LOG',
        date: yesterday,
        data: { skincare: { am: true, pm: false } },
        updated_at: 1234567890,
      },
      {
        PK: 'USER#me',
        SK: `DAY#${today}`,
        type: 'DAILY_LOG',
        date: today,
        data: { skincare: { am: true, pm: true } },
        updated_at: 1234567891,
      },
    ];

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: logItems } as any);

    const res = await app().request('/streaks', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.streaks)).toBe(true);
    expect(body.streaks).toHaveLength(3);

    const categories = body.streaks.map((s: { category: string }) => s.category);
    expect(categories).toContain('daily_log');
    expect(categories).toContain('skincare_am');
    expect(categories).toContain('skincare_pm');

    const dailyLog = body.streaks.find((s: { category: string }) => s.category === 'daily_log');
    expect(dailyLog.current).toBe(2);
    expect(dailyLog.longest).toBe(2);

    const skincareAm = body.streaks.find((s: { category: string }) => s.category === 'skincare_am');
    expect(skincareAm.current).toBe(2);

    const skincarePm = body.streaks.find((s: { category: string }) => s.category === 'skincare_pm');
    expect(skincarePm.current).toBe(1);
  });

  it('returns all zeros when no daily logs exist', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/streaks', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.streaks).toHaveLength(3);
    for (const streak of body.streaks) {
      expect(streak.current).toBe(0);
      expect(streak.longest).toBe(0);
    }
  });
});
