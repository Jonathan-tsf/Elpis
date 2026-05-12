import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { persistXpEvents, readStats, writeStats, awardXp } from '../src/services/xp-persistence';
import type { XpDelta } from '../src/services/xp-engine';
import type { Stats } from '@lifeos/shared';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const ddbMock = mockClient(DynamoDBDocumentClient as any);

beforeAll(() => {
  process.env['TABLE_NAME'] = 'test';
});

beforeEach(() => {
  ddbMock.reset();
});

function makeDoc(): DynamoDBDocumentClient {
  return DynamoDBDocumentClient.from(new DynamoDBClient({ region: 'us-east-1' }));
}

const DELTAS: XpDelta[] = [
  { stat: 'discipline', amount: 20, reason: 'daily_log_saved' },
  { stat: 'vitality', amount: 30, reason: 'sleep_8h_plus' },
];

describe('persistXpEvents', () => {
  it('sends N PutCommands — one per delta', async () => {
    ddbMock.on(PutCommand as never).resolves({});
    await persistXpEvents(makeDoc(), DELTAS, 'daily_log:2026-05-12');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const calls = ddbMock.commandCalls(PutCommand as any);
    expect(calls).toHaveLength(DELTAS.length);

    for (let i = 0; i < DELTAS.length; i++) {
      const input = calls[i]?.args[0].input as Record<string, unknown>;
      const item = input['Item'] as Record<string, unknown>;
      expect(item['PK']).toBe('USER#me');
      expect(typeof item['SK']).toBe('string');
      expect((item['SK'] as string).startsWith('XP#')).toBe(true);
      expect(item['source']).toBe('daily_log:2026-05-12');
      expect(item['stat']).toBe(DELTAS[i]?.stat);
      expect(item['amount']).toBe(DELTAS[i]?.amount);
      expect(item['reason']).toBe(DELTAS[i]?.reason);
    }
  });
});

describe('awardXp', () => {
  it('reads stats (null), computes new state, writes stats, writes events, returns new stats', async () => {
    // First GetCommand (readStats) returns null (no existing stats)
    ddbMock.on(GetCommand as never).resolves({});
    // All PutCommands resolve ok
    ddbMock.on(PutCommand as never).resolves({});

    const result = await awardXp(makeDoc(), DELTAS, 'daily_log:2026-05-12');

    // Should have written stats + 2 xp events = 3 puts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const puts = ddbMock.commandCalls(PutCommand as any);
    expect(puts).toHaveLength(3); // 1 stats write + 2 XP events

    // Verify the returned stats
    expect(result.per_stat['discipline']?.xp).toBe(20);
    expect(result.per_stat['vitality']?.xp).toBe(30);
    expect(result.global_xp).toBe(50);
    expect(typeof result.updated_at).toBe('number');
  });

  it('reads existing stats and accumulates XP on top', async () => {
    const existingStats: Stats = {
      global_level: 1,
      global_xp: 50,
      per_stat: {
        discipline: { level: 1, xp: 50, xp_to_next: 150 },
        vitality: { level: 1, xp: 0, xp_to_next: 200 },
        force: { level: 1, xp: 0, xp_to_next: 200 },
        endurance: { level: 1, xp: 0, xp_to_next: 200 },
        appearance: { level: 1, xp: 0, xp_to_next: 200 },
        spirit: { level: 1, xp: 0, xp_to_next: 200 },
      },
      updated_at: 1000,
    };
    const storedItem = { PK: 'USER#me', SK: 'STATS', type: 'STATS', stats: existingStats };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({ Item: storedItem } as any);
    ddbMock.on(PutCommand as never).resolves({});

    const result = await awardXp(makeDoc(), DELTAS, 'daily_log:2026-05-12');

    // discipline: 50 + 20 = 70
    expect(result.per_stat['discipline']?.xp).toBe(70);
    // vitality: 0 + 30 = 30
    expect(result.per_stat['vitality']?.xp).toBe(30);
    expect(result.global_xp).toBe(100);
  });
});
