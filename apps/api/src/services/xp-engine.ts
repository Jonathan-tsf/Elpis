import { type DailyLogInput, type WorkoutInput, type Stats, type StatName, type PhotoConfirmInput, type PerfTestInput } from '@lifeos/shared';

export type XpDelta = { stat: StatName; amount: number; reason: string };

export const XP_PER_LEVEL = 200;

export function deltasForDailyLog(input: DailyLogInput): XpDelta[] {
  const deltas: XpDelta[] = [];

  // Always awarded
  deltas.push({ stat: 'discipline', amount: 20, reason: 'daily_log_saved' });

  // Sleep XP
  if (input.sleep != null) {
    if (input.sleep.duration_min >= 480) {
      deltas.push({ stat: 'vitality', amount: 30, reason: 'sleep_8h_plus' });
    } else if (input.sleep.duration_min >= 420) {
      deltas.push({ stat: 'vitality', amount: 15, reason: 'sleep_7h_plus' });
    }
  }

  // Mood XP
  if (input.mood != null) {
    deltas.push({ stat: 'spirit', amount: 5, reason: 'mood_logged' });
    const avg = (input.mood.mood + input.mood.energy + input.mood.focus) / 3;
    if (avg >= 7) {
      deltas.push({ stat: 'spirit', amount: 10, reason: 'mood_high_avg' });
    }
  }

  // Hydration XP
  if (input.hydration_l != null && input.hydration_l >= 2.5) {
    deltas.push({ stat: 'vitality', amount: 10, reason: 'hydration_target' });
  }

  // Skincare XP
  if (input.skincare?.am) {
    deltas.push({ stat: 'appearance', amount: 5, reason: 'skincare_am' });
  }
  if (input.skincare?.pm) {
    deltas.push({ stat: 'appearance', amount: 5, reason: 'skincare_pm' });
  }

  // Supplements XP
  if (input.supplements != null && input.supplements.length > 0) {
    deltas.push({ stat: 'vitality', amount: 3, reason: 'supplements_logged' });
  }

  return deltas;
}

export function deltasForWorkout(input: WorkoutInput): XpDelta[] {
  const out: XpDelta[] = [];
  out.push({ stat: 'discipline', amount: 20, reason: 'workout_completed' });

  const isStrength = ['push', 'pull', 'legs', 'upper', 'lower', 'full'].includes(input.type);
  const isCardio = input.type === 'cardio';

  if (isStrength) {
    out.push({ stat: 'force', amount: 30, reason: 'workout_strength' });
  }
  if (isCardio) {
    out.push({ stat: 'endurance', amount: 30, reason: 'workout_cardio' });
  }
  if (input.rpe != null && input.rpe >= 8) {
    out.push({
      stat: isStrength ? 'force' : 'endurance',
      amount: 20,
      reason: 'workout_high_rpe',
    });
  }
  const totalSets = input.exercises.reduce((acc, e) => acc + e.sets.length, 0);
  if (totalSets >= 12) {
    out.push({ stat: 'endurance', amount: 10, reason: 'workout_volume_12_sets' });
  }
  return out;
}

const PROTOCOL_TAGS: Set<string> = new Set([
  'face',
  'profile_left',
  'profile_right',
  'three_quarter',
  'back',
  'posture',
  'body_front',
  'body_back',
  'body_side',
]);

export function deltasForPhoto(input: PhotoConfirmInput): XpDelta[] {
  const out: XpDelta[] = [];
  out.push({ stat: 'discipline', amount: 5, reason: 'photo_logged' });
  if (input.tags.some((t) => PROTOCOL_TAGS.has(t))) {
    out.push({ stat: 'appearance', amount: 15, reason: 'photo_protocolaire' });
  }
  return out;
}

const STRENGTH_PERF_TESTS = new Set(['1rm_bench', '1rm_squat', '1rm_deadlift', '1rm_ohp', 'pullups_max', 'pushups_max', 'plank_max']);
const CARDIO_PERF_TESTS = new Set(['vo2max', 'mile_time', '5k_time']);

export function deltasForPerfTest(input: PerfTestInput): XpDelta[] {
  const out: XpDelta[] = [];
  out.push({ stat: 'discipline', amount: 15, reason: 'perf_test_logged' });
  if (STRENGTH_PERF_TESTS.has(input.type)) {
    out.push({ stat: 'force', amount: 50, reason: `perf_test_strength:${input.type}` });
  } else if (CARDIO_PERF_TESTS.has(input.type)) {
    out.push({ stat: 'endurance', amount: 50, reason: `perf_test_cardio:${input.type}` });
  }
  return out;
}

const ALL_STATS: StatName[] = ['force', 'endurance', 'vitality', 'discipline', 'appearance', 'spirit'];

function computeLevel(totalXp: number): { level: number; xp_to_next: number } {
  const raw = Math.floor(totalXp / XP_PER_LEVEL) + 1;
  const level = Math.min(raw, 100);
  const xp_to_next = XP_PER_LEVEL - (totalXp % XP_PER_LEVEL);
  return { level, xp_to_next };
}

export function applyDeltasToStats(current: Stats | null, deltas: XpDelta[]): Stats {
  // Build initial per_stat map
  const perStat: Stats['per_stat'] = current != null
    ? { ...current.per_stat }
    : Object.fromEntries(
        ALL_STATS.map((s) => [s, { level: 1, xp: 0, xp_to_next: XP_PER_LEVEL }]),
      ) as Stats['per_stat'];

  // If starting fresh, fill in any missing stats
  if (current == null) {
    for (const stat of ALL_STATS) {
      if (perStat[stat] == null) {
        perStat[stat] = { level: 1, xp: 0, xp_to_next: XP_PER_LEVEL };
      }
    }
  }

  // Apply each delta
  for (const delta of deltas) {
    const existing = perStat[delta.stat] ?? { level: 1, xp: 0, xp_to_next: XP_PER_LEVEL };
    const newXp = existing.xp + delta.amount;
    const { level, xp_to_next } = computeLevel(newXp);
    perStat[delta.stat] = { level, xp: newXp, xp_to_next };
  }

  // Recompute global stats
  const globalXp = ALL_STATS.reduce((sum, s) => sum + (perStat[s]?.xp ?? 0), 0);
  const rawGlobal = Math.floor(globalXp / (XP_PER_LEVEL * 6)) + 1;
  const globalLevel = Math.min(rawGlobal, 100);

  return {
    global_level: globalLevel,
    global_xp: globalXp,
    per_stat: perStat,
    updated_at: Date.now(),
  };
}
