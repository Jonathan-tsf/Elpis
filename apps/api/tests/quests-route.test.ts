import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
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

describe('GET /quests', () => {
  it('returns 401 without Authorization header', async () => {
    const res = await app().request('/quests');
    expect(res.status).toBe(401);
  });

  it('returns 5 quests all active when no daily log exists', async () => {
    // No item returned = no today's log
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({} as any);

    const res = await app().request('/quests', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body).toHaveLength(5);
    for (const quest of body) {
      expect(quest.status).toBe('active');
      expect(typeof quest.id).toBe('string');
      expect(typeof quest.title).toBe('string');
      expect(typeof quest.xp_reward).toBe('number');
    }
  });

  it('returns correct statuses based on a stored DailyLog', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const dailyLogItem = {
      PK: 'USER#me',
      SK: `DAY#${today}`,
      type: 'DAILY_LOG',
      date: today,
      data: {
        sleep: { duration_min: 480 }, // 8h — satisfies daily_sleep_8h
        skincare: { am: true, pm: false }, // satisfies daily_skincare_am, NOT pm
        hydration_l: 3.0, // satisfies daily_hydration
      },
      updated_at: Date.now(),
    };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: dailyLogItem } as any);

    const res = await app().request('/quests', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(5);

    const byId = Object.fromEntries(body.map((q: { id: string }) => [q.id, q]));

    // daily_log_filled: log exists → done
    expect(byId['daily_log_filled'].status).toBe('done');

    // daily_sleep_8h: 480 min = 8h → done
    expect(byId['daily_sleep_8h'].status).toBe('done');

    // daily_skincare_am: am=true → done
    expect(byId['daily_skincare_am'].status).toBe('done');

    // daily_skincare_pm: pm=false → active
    expect(byId['daily_skincare_pm'].status).toBe('active');

    // daily_hydration: 3.0 >= 2.5 → done
    expect(byId['daily_hydration'].status).toBe('done');
  });
});
