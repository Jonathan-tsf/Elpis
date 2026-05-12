import type { Stats, DailyLogInput, Photo, Measurement, StatName } from '@lifeos/shared';

export interface AchievementState {
  stats: Stats | null;
  dailyLogs: { date: string; data: DailyLogInput }[];
  workouts: { id: string; data: { date: string } & Record<string, unknown> }[];
  photos: Photo[];
  measurements: Measurement[];
  hasCoachConversation: boolean;
  hasVoiceJournal: boolean;
}

type Predicate = (s: AchievementState) => boolean;

function maxConsecutive(dates: string[]): number {
  if (dates.length === 0) return 0;
  const sorted = [...new Set(dates)].sort();
  let max = 1;
  let cur = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]! + 'T00:00:00Z').getTime();
    const next = new Date(sorted[i]! + 'T00:00:00Z').getTime();
    if (Math.round((next - prev) / 86400000) === 1) {
      cur += 1;
      max = Math.max(max, cur);
    } else {
      cur = 1;
    }
  }
  return max;
}

function statLevel(stats: Stats | null, stat: StatName): number {
  return stats?.per_stat?.[stat]?.level ?? 1;
}

const PREDICATES: Record<string, Predicate> = {
  sleep_8h_first: (s) => s.dailyLogs.some((l) => (l.data.sleep?.duration_min ?? 0) >= 480),
  sleep_7d_streak: (s) =>
    maxConsecutive(
      s.dailyLogs.filter((l) => (l.data.sleep?.duration_min ?? 0) >= 420).map((l) => l.date),
    ) >= 7,
  sleep_30d_streak: (s) =>
    maxConsecutive(
      s.dailyLogs.filter((l) => (l.data.sleep?.duration_min ?? 0) >= 420).map((l) => l.date),
    ) >= 30,

  workout_first: (s) => s.workouts.length >= 1,
  workout_10: (s) => s.workouts.length >= 10,
  workout_50: (s) => s.workouts.length >= 50,
  workout_100: (s) => s.workouts.length >= 100,
  workout_4_per_week: (s) => {
    const dates = s.workouts
      .map((w) => new Date((w.data.date as string) + 'T00:00:00Z').getTime())
      .sort();
    for (let i = 0; i < dates.length; i++) {
      const start = dates[i]!;
      let count = 0;
      for (let j = i; j < dates.length && dates[j]! < start + 7 * 86400000; j++) count++;
      if (count >= 4) return true;
    }
    return false;
  },

  photo_first: (s) => s.photos.length >= 1,
  photo_100: (s) => s.photos.length >= 100,
  photo_protocol_set: (s) => {
    const byWeek: Record<string, Set<string>> = {};
    for (const p of s.photos) {
      const d = new Date(p.date + 'T00:00:00Z');
      const week = `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
      byWeek[week] = byWeek[week] ?? new Set();
      for (const t of p.tags) byWeek[week]!.add(t);
    }
    return Object.values(byWeek).some(
      (tags) =>
        tags.has('face') &&
        tags.has('profile_left') &&
        tags.has('profile_right') &&
        tags.has('posture'),
    );
  },

  skincare_30d: (s) =>
    maxConsecutive(
      s.dailyLogs.filter((l) => l.data.skincare?.am && l.data.skincare?.pm).map((l) => l.date),
    ) >= 30,

  daily_log_7d: (s) => maxConsecutive(s.dailyLogs.map((l) => l.date)) >= 7,
  daily_log_30d: (s) => maxConsecutive(s.dailyLogs.map((l) => l.date)) >= 30,
  daily_log_100d: (s) => maxConsecutive(s.dailyLogs.map((l) => l.date)) >= 100,

  level_5_global: (s) => (s.stats?.global_level ?? 1) >= 5,
  level_10_global: (s) => (s.stats?.global_level ?? 1) >= 10,
  level_25_global: (s) => (s.stats?.global_level ?? 1) >= 25,
  level_50_global: (s) => (s.stats?.global_level ?? 1) >= 50,

  force_level_10: (s) => statLevel(s.stats, 'force') >= 10,
  endurance_level_10: (s) => statLevel(s.stats, 'endurance') >= 10,
  vitality_level_10: (s) => statLevel(s.stats, 'vitality') >= 10,
  discipline_level_10: (s) => statLevel(s.stats, 'discipline') >= 10,
  appearance_level_10: (s) => statLevel(s.stats, 'appearance') >= 10,
  spirit_level_10: (s) => statLevel(s.stats, 'spirit') >= 10,

  measurement_first: (s) => s.measurements.length >= 1,
  measurement_4_weeks: (s) => {
    const weeks = new Set(
      s.measurements.map((m) => {
        const d = new Date((m.date as string) + 'T00:00:00Z');
        return `${d.getUTCFullYear()}-W${Math.floor(d.getUTCDate() / 7)}`;
      }),
    );
    return weeks.size >= 4;
  },

  hydration_7d_target: (s) =>
    maxConsecutive(
      s.dailyLogs.filter((l) => (l.data.hydration_l ?? 0) >= 2.5).map((l) => l.date),
    ) >= 7,

  coach_first_conv: (s) => s.hasCoachConversation,
  voice_journal_first: (s) => s.hasVoiceJournal,
};

export function detectUnlocked(state: AchievementState): string[] {
  const out: string[] = [];
  for (const [id, predicate] of Object.entries(PREDICATES)) {
    if (predicate(state)) out.push(id);
  }
  return out;
}
