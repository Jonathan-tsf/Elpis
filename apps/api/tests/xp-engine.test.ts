import { describe, expect, it } from 'vitest';
import { deltasForDailyLog, deltasForWorkout, applyDeltasToStats, XP_PER_LEVEL, type XpDelta } from '../src/services/xp-engine';
import type { DailyLogInput, WorkoutInput } from '@lifeos/shared';

describe('deltasForDailyLog', () => {
  it('empty input yields only always-on +20 Discipline', () => {
    const deltas = deltasForDailyLog({});
    expect(deltas).toHaveLength(1);
    expect(deltas[0]).toEqual({ stat: 'discipline', amount: 20, reason: 'daily_log_saved' });
  });

  it('8h sleep + skincare AM/PM + hydration 3L + high mood => 7 deltas', () => {
    const input: DailyLogInput = {
      sleep: { duration_min: 480 },
      skincare: { am: true, pm: true },
      hydration_l: 3,
      mood: { mood: 8, energy: 7, focus: 7 },
    };
    const deltas = deltasForDailyLog(input);
    expect(deltas).toHaveLength(7);

    // Always-on
    expect(deltas.find((d) => d.reason === 'daily_log_saved')).toEqual({
      stat: 'discipline',
      amount: 20,
      reason: 'daily_log_saved',
    });
    // Sleep
    expect(deltas.find((d) => d.reason === 'sleep_8h_plus')).toEqual({
      stat: 'vitality',
      amount: 30,
      reason: 'sleep_8h_plus',
    });
    // Mood base
    expect(deltas.find((d) => d.reason === 'mood_logged')).toEqual({
      stat: 'spirit',
      amount: 5,
      reason: 'mood_logged',
    });
    // Mood high avg: (8+7+7)/3 = 7.33 >= 7
    expect(deltas.find((d) => d.reason === 'mood_high_avg')).toEqual({
      stat: 'spirit',
      amount: 10,
      reason: 'mood_high_avg',
    });
    // Hydration
    expect(deltas.find((d) => d.reason === 'hydration_target')).toEqual({
      stat: 'vitality',
      amount: 10,
      reason: 'hydration_target',
    });
    // Skincare AM
    expect(deltas.find((d) => d.reason === 'skincare_am')).toEqual({
      stat: 'appearance',
      amount: 5,
      reason: 'skincare_am',
    });
    // Skincare PM
    expect(deltas.find((d) => d.reason === 'skincare_pm')).toEqual({
      stat: 'appearance',
      amount: 5,
      reason: 'skincare_pm',
    });
  });

  it('7h sleep (420 min) => +15 Vitalité (not +30)', () => {
    const deltas = deltasForDailyLog({ sleep: { duration_min: 420 } });
    const sleepDelta = deltas.find((d) => d.stat === 'vitality' && d.reason.startsWith('sleep_'));
    expect(sleepDelta).toBeDefined();
    expect(sleepDelta?.amount).toBe(15);
    expect(sleepDelta?.reason).toBe('sleep_7h_plus');
    expect(deltas.find((d) => d.reason === 'sleep_8h_plus')).toBeUndefined();
  });

  it('less than 7h sleep => no sleep XP', () => {
    const deltas = deltasForDailyLog({ sleep: { duration_min: 360 } });
    expect(deltas.find((d) => d.reason === 'sleep_8h_plus')).toBeUndefined();
    expect(deltas.find((d) => d.reason === 'sleep_7h_plus')).toBeUndefined();
  });
});

describe('deltasForWorkout', () => {
  const baseExercises: WorkoutInput['exercises'] = [
    { name: 'Bench Press', sets: [{ reps: 8 }, { reps: 8 }, { reps: 8 }] },
  ];

  it('type=push, no rpe => 2 deltas (discipline + force)', () => {
    const input: WorkoutInput = { date: '2026-05-10', type: 'push', exercises: baseExercises };
    const deltas = deltasForWorkout(input);
    expect(deltas).toHaveLength(2);
    expect(deltas.find((d) => d.reason === 'workout_completed')).toBeDefined();
    expect(deltas.find((d) => d.reason === 'workout_strength')).toBeDefined();
    expect(deltas.find((d) => d.stat === 'force')).toBeDefined();
  });

  it('type=push with rpe=9 => 3 deltas (discipline + force + high_rpe force)', () => {
    const input: WorkoutInput = { date: '2026-05-10', type: 'push', rpe: 9, exercises: baseExercises };
    const deltas = deltasForWorkout(input);
    expect(deltas).toHaveLength(3);
    expect(deltas.find((d) => d.reason === 'workout_high_rpe')).toBeDefined();
    expect(deltas.find((d) => d.reason === 'workout_high_rpe')?.stat).toBe('force');
  });

  it('type=cardio, no rpe => 2 deltas (discipline + endurance)', () => {
    const input: WorkoutInput = { date: '2026-05-10', type: 'cardio', exercises: [] };
    const deltas = deltasForWorkout(input);
    expect(deltas).toHaveLength(2);
    expect(deltas.find((d) => d.reason === 'workout_cardio')).toBeDefined();
    expect(deltas.find((d) => d.stat === 'endurance')).toBeDefined();
  });

  it('type=push with 15 sets total => 3 deltas (discipline + force + volume_12_sets endurance)', () => {
    const fifteenSets: WorkoutInput['exercises'] = [
      { name: 'Squat', sets: Array.from({ length: 15 }, () => ({ reps: 8 })) },
    ];
    const input: WorkoutInput = { date: '2026-05-10', type: 'push', exercises: fifteenSets };
    const deltas = deltasForWorkout(input);
    expect(deltas).toHaveLength(3);
    expect(deltas.find((d) => d.reason === 'workout_volume_12_sets')).toBeDefined();
    expect(deltas.find((d) => d.reason === 'workout_volume_12_sets')?.stat).toBe('endurance');
  });

  it('type=mobility => 1 delta (only discipline)', () => {
    const input: WorkoutInput = { date: '2026-05-10', type: 'mobility', exercises: [] };
    const deltas = deltasForWorkout(input);
    expect(deltas).toHaveLength(1);
    expect(deltas[0]?.reason).toBe('workout_completed');
    expect(deltas[0]?.stat).toBe('discipline');
  });
});

describe('applyDeltasToStats', () => {
  it('null current => fresh Stats with correct per-stat XP and levels', () => {
    const deltas: XpDelta[] = [
      { stat: 'discipline', amount: 20, reason: 'daily_log_saved' },
      { stat: 'vitality', amount: 30, reason: 'sleep_8h_plus' },
    ];
    const stats = applyDeltasToStats(null, deltas);

    expect(stats.per_stat['discipline']?.xp).toBe(20);
    expect(stats.per_stat['discipline']?.level).toBe(1);
    expect(stats.per_stat['discipline']?.xp_to_next).toBe(XP_PER_LEVEL - 20);

    expect(stats.per_stat['vitality']?.xp).toBe(30);
    expect(stats.per_stat['vitality']?.level).toBe(1);
    expect(stats.per_stat['vitality']?.xp_to_next).toBe(XP_PER_LEVEL - 30);

    // Untouched stats remain at 0 xp, level 1
    expect(stats.per_stat['force']?.xp).toBe(0);
    expect(stats.per_stat['force']?.level).toBe(1);

    expect(stats.global_xp).toBe(50);
    expect(stats.global_level).toBe(1);
  });

  it('level-up at 200 XP: delta of 250 on null => level 2, xp 250, xp_to_next 150', () => {
    const deltas: XpDelta[] = [{ stat: 'force', amount: 250, reason: 'test' }];
    const stats = applyDeltasToStats(null, deltas);
    const forceStat = stats.per_stat['force'];
    expect(forceStat?.xp).toBe(250);
    // floor(250/200)+1 = 2
    expect(forceStat?.level).toBe(2);
    // 200 - (250 % 200) = 200 - 50 = 150
    expect(forceStat?.xp_to_next).toBe(150);
  });

  it('cap at level 100', () => {
    // 100 levels requires >= 99*200 = 19800 XP (level = floor(xp/200)+1, cap at 100 means floor(xp/200)+1 >= 100 when xp >= 19800)
    const deltas: XpDelta[] = [{ stat: 'force', amount: 20000, reason: 'test' }];
    const stats = applyDeltasToStats(null, deltas);
    expect(stats.per_stat['force']?.level).toBe(100);
  });
});
