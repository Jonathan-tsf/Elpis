import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import {
  DynamoDBDocumentClient,
  GetCommand,
  PutCommand,
  QueryCommand,
} from '@aws-sdk/lib-dynamodb';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { detectUnlocked, type AchievementState } from '../src/services/achievements';
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

function emptyState(): AchievementState {
  return {
    stats: null,
    dailyLogs: [],
    workouts: [],
    photos: [],
    measurements: [],
    hasCoachConversation: false,
    hasVoiceJournal: false,
  };
}

describe('detectUnlocked (unit)', () => {
  it('returns empty array for empty state', () => {
    const result = detectUnlocked(emptyState());
    expect(result).toHaveLength(0);
  });

  it('unlocks workout_first with 1 workout', () => {
    const state = emptyState();
    state.workouts = [{ id: 'w1', data: { date: '2026-05-01' } }];
    const result = detectUnlocked(state);
    expect(result).toContain('workout_first');
  });

  it('unlocks workout_10 with 10 workouts', () => {
    const state = emptyState();
    state.workouts = Array.from({ length: 10 }, (_, i) => ({
      id: `w${i}`,
      data: { date: `2026-05-${String(i + 1).padStart(2, '0')}` },
    }));
    const result = detectUnlocked(state);
    expect(result).toContain('workout_10');
    expect(result).toContain('workout_first');
  });

  it('does not unlock workout_10 with only 5 workouts', () => {
    const state = emptyState();
    state.workouts = Array.from({ length: 5 }, (_, i) => ({
      id: `w${i}`,
      data: { date: `2026-05-${String(i + 1).padStart(2, '0')}` },
    }));
    const result = detectUnlocked(state);
    expect(result).not.toContain('workout_10');
  });

  it('unlocks daily_log_7d with 7 consecutive daily logs', () => {
    const state = emptyState();
    state.dailyLogs = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      data: {} as never,
    }));
    const result = detectUnlocked(state);
    expect(result).toContain('daily_log_7d');
  });

  it('does not unlock daily_log_7d with gap in logs', () => {
    const state = emptyState();
    // Gap at day 4 (skipping May 4)
    state.dailyLogs = ['2026-05-01', '2026-05-02', '2026-05-03', '2026-05-05', '2026-05-06', '2026-05-07', '2026-05-08'].map(
      (date) => ({ date, data: {} as never }),
    );
    const result = detectUnlocked(state);
    expect(result).not.toContain('daily_log_7d');
  });

  it('unlocks sleep_7d_streak with 7 consecutive nights >= 7h', () => {
    const state = emptyState();
    state.dailyLogs = Array.from({ length: 7 }, (_, i) => ({
      date: `2026-05-${String(i + 1).padStart(2, '0')}`,
      data: { sleep: { duration_min: 450 } } as never,
    }));
    const result = detectUnlocked(state);
    expect(result).toContain('sleep_7d_streak');
  });

  it('unlocks sleep_8h_first with a single 8h+ sleep', () => {
    const state = emptyState();
    state.dailyLogs = [{ date: '2026-05-01', data: { sleep: { duration_min: 480 } } as never }];
    const result = detectUnlocked(state);
    expect(result).toContain('sleep_8h_first');
  });

  it('unlocks photo_first with 1 photo', () => {
    const state = emptyState();
    state.photos = [{ id: 'p1', date: '2026-05-01', s3_key: 'k', tags: ['face'], created_at: 1 }];
    const result = detectUnlocked(state);
    expect(result).toContain('photo_first');
  });

  it('unlocks coach_first_conv when hasCoachConversation is true', () => {
    const state = emptyState();
    state.hasCoachConversation = true;
    const result = detectUnlocked(state);
    expect(result).toContain('coach_first_conv');
  });

  it('unlocks level_5_global when global_level >= 5', () => {
    const state = emptyState();
    state.stats = {
      global_level: 5, global_xp: 1000, per_stat: {} as never, updated_at: 1,
    };
    const result = detectUnlocked(state);
    expect(result).toContain('level_5_global');
  });

  it('does not unlock level_5_global when global_level is 4', () => {
    const state = emptyState();
    state.stats = {
      global_level: 4, global_xp: 800, per_stat: {} as never, updated_at: 1,
    };
    const result = detectUnlocked(state);
    expect(result).not.toContain('level_5_global');
  });
});

describe('GET /achievements', () => {
  it('returns 401 without auth', async () => {
    const res = await app().request('/achievements');
    expect(res.status).toBe(401);
  });

  it('returns achievement list with unlocked status', async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never).resolves({ Items: [] } as any);

    const res = await app().request('/achievements', { headers: authHeader() });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(typeof body.total).toBe('number');
    expect(body.total).toBeGreaterThan(20);
    expect(typeof body.unlocked_count).toBe('number');
    expect(body.unlocked_count).toBe(0);
    expect(Array.isArray(body.achievements)).toBe(true);
    expect(body.achievements[0]).toHaveProperty('id');
    expect(body.achievements[0]).toHaveProperty('unlocked');
  });
});

describe('POST /achievements/detect', () => {
  it('returns 401 without auth', async () => {
    const res = await app().request('/achievements/detect', { method: 'POST' });
    expect(res.status).toBe(401);
  });

  it('detects and persists newly unlocked achievements', async () => {
    // Simulate: 1 workout exists, no existing achievements
    const workoutItem = {
      PK: 'USER#me',
      SK: 'WORKOUT#2026-05-01#w1',
      type: 'WORKOUT',
      id: 'w1',
      data: { date: '2026-05-01' },
    };

    // GetItem (stats) → empty
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(GetCommand as never).resolves({} as any);

    // The detect endpoint issues 7 queryItems calls in order:
    // DAY#, WORKOUT#, PHOTO#, MEAS#, THREAD#, VOICE_JOB#, then ACH# for existing check
    // We respond with workout data for the 2nd call and empty for the rest.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(QueryCommand as never)
      .resolvesOnce({ Items: [] } as any)           // DAY#
      .resolvesOnce({ Items: [workoutItem] } as any) // WORKOUT#
      .resolves({ Items: [] } as any);              // PHOTO#, MEAS#, THREAD#, VOICE_JOB#, ACH#

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ddbMock.on(PutCommand as never).resolves({} as any);

    const res = await app().request('/achievements/detect', {
      method: 'POST',
      headers: authHeader(),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.newly_unlocked)).toBe(true);
    expect(body.newly_unlocked).toContain('workout_first');
  });
});
