import { Hono } from 'hono';
import { getDocClient, getItem, putItem, queryItems } from '../services/dynamodb-client';
import { USER_PK, statsKey } from '../services/keys';
import { detectUnlocked, type AchievementState } from '../services/achievements';
import { awardXp } from '../services/xp-persistence';
import { ACHIEVEMENTS, getAchievement } from '@lifeos/shared';
import type { Stats, DailyLogInput, Photo, Measurement } from '@lifeos/shared';

interface UnlockedItem {
  PK: string;
  SK: string;
  type: 'ACHIEVEMENT';
  id: string;
  unlocked_at: number;
}

interface StatsItem {
  stats: Stats;
}

interface DailyLogItem {
  date: string;
  data: DailyLogInput;
}

interface WorkoutItem {
  id: string;
  data: { date: string } & Record<string, unknown>;
}

interface MeasurementItem {
  data: Measurement;
}

export function achievementsRoute() {
  const app = new Hono<{ Variables: { user: { sub: string } } }>();

  // GET / — list all achievements with unlock status
  app.get('/', async (c) => {
    const doc = getDocClient();
    const unlocked = await queryItems<UnlockedItem>(doc, { pk: USER_PK, skBegins: 'ACH#' });
    const unlockedMap = new Map(unlocked.map((u) => [u.id, u.unlocked_at]));
    const list = ACHIEVEMENTS.map((a) => ({
      ...a,
      unlocked: unlockedMap.has(a.id),
      unlocked_at: unlockedMap.get(a.id),
    }));
    return c.json({ achievements: list, total: ACHIEVEMENTS.length, unlocked_count: unlocked.length });
  });

  // POST /detect — check and persist newly unlocked achievements
  app.post('/detect', async (c) => {
    const doc = getDocClient();
    const skey = statsKey();
    const statsItem = await getItem<StatsItem>(doc, skey.pk, skey.sk);
    const dailyLogs = await queryItems<DailyLogItem>(doc, { pk: USER_PK, skBegins: 'DAY#' });
    const workouts = await queryItems<WorkoutItem>(doc, { pk: USER_PK, skBegins: 'WORKOUT#' });
    const photos = await queryItems<Photo>(doc, { pk: USER_PK, skBegins: 'PHOTO#' });
    const measurementItems = await queryItems<MeasurementItem>(doc, { pk: USER_PK, skBegins: 'MEAS#' });
    const measurements = measurementItems.map((m) => m.data);
    const threads = await queryItems(doc, { pk: USER_PK, skBegins: 'THREAD#' });
    const voiceJobs = await queryItems(doc, { pk: USER_PK, skBegins: 'VOICE_JOB#' });

    const state: AchievementState = {
      stats: statsItem?.stats ?? null,
      dailyLogs,
      workouts,
      photos,
      measurements,
      hasCoachConversation: threads.length > 0,
      hasVoiceJournal: voiceJobs.length > 0,
    };

    const currentlyUnlockedIds = detectUnlocked(state);
    const existing = await queryItems<UnlockedItem>(doc, { pk: USER_PK, skBegins: 'ACH#' });
    const existingIds = new Set(existing.map((e) => e.id));

    const newly: string[] = [];
    const now = Date.now();
    for (const id of currentlyUnlockedIds) {
      if (existingIds.has(id)) continue;
      const item: UnlockedItem = {
        PK: USER_PK,
        SK: `ACH#${id}`,
        type: 'ACHIEVEMENT',
        id,
        unlocked_at: now,
      };
      await putItem(doc, item as unknown as Record<string, unknown>);
      newly.push(id);

      const a = getAchievement(id);
      if (a && a.xp_reward > 0) {
        await awardXp(
          doc,
          [{ stat: a.stat ?? 'discipline', amount: a.xp_reward, reason: `achievement:${id}` }],
          `achievement:${id}`,
        );
      }
    }

    return c.json({ newly_unlocked: newly });
  });

  return app;
}
