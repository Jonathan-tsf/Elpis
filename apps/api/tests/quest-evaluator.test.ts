import { describe, expect, it } from 'vitest';
import { evaluateCondition } from '../src/services/quest-evaluator';
import type { QuestCondition, DailyLogInput } from '@lifeos/shared';

const fullLog: DailyLogInput = {
  sleep: { duration_min: 480 }, // 8h
  skincare: { am: true, pm: true },
  hydration_l: 3.0,
};

describe('evaluateCondition', () => {
  it('returns false for null log (any condition)', () => {
    const cond: QuestCondition = { type: 'daily_log_filled' };
    expect(evaluateCondition(cond, null)).toBe(false);
  });

  it('daily_log_filled => true when log exists', () => {
    const cond: QuestCondition = { type: 'daily_log_filled' };
    expect(evaluateCondition(cond, {})).toBe(true);
    expect(evaluateCondition(cond, fullLog)).toBe(true);
  });

  it('sleep_hours_gte 8 => true when 480 min (8h)', () => {
    const cond: QuestCondition = { type: 'sleep_hours_gte', params: { hours: 8 } };
    expect(evaluateCondition(cond, { sleep: { duration_min: 480 } })).toBe(true);
  });

  it('sleep_hours_gte 8 => false when 420 min (7h)', () => {
    const cond: QuestCondition = { type: 'sleep_hours_gte', params: { hours: 8 } };
    expect(evaluateCondition(cond, { sleep: { duration_min: 420 } })).toBe(false);
  });

  it('sleep_hours_gte 8 => false when no sleep data', () => {
    const cond: QuestCondition = { type: 'sleep_hours_gte', params: { hours: 8 } };
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it('skincare_am_done => true when am=true', () => {
    const cond: QuestCondition = { type: 'skincare_am_done' };
    expect(evaluateCondition(cond, { skincare: { am: true, pm: false } })).toBe(true);
  });

  it('skincare_am_done => false when am=false', () => {
    const cond: QuestCondition = { type: 'skincare_am_done' };
    expect(evaluateCondition(cond, { skincare: { am: false, pm: false } })).toBe(false);
  });

  it('skincare_am_done => false when no skincare data', () => {
    const cond: QuestCondition = { type: 'skincare_am_done' };
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it('skincare_pm_done => true when pm=true', () => {
    const cond: QuestCondition = { type: 'skincare_pm_done' };
    expect(evaluateCondition(cond, { skincare: { am: false, pm: true } })).toBe(true);
  });

  it('skincare_pm_done => false when pm=false', () => {
    const cond: QuestCondition = { type: 'skincare_pm_done' };
    expect(evaluateCondition(cond, { skincare: { am: false, pm: false } })).toBe(false);
  });

  it('hydration_l_gte 2.5 => true when 3.0L', () => {
    const cond: QuestCondition = { type: 'hydration_l_gte', params: { liters: 2.5 } };
    expect(evaluateCondition(cond, { hydration_l: 3.0 })).toBe(true);
  });

  it('hydration_l_gte 2.5 => true when exactly 2.5L', () => {
    const cond: QuestCondition = { type: 'hydration_l_gte', params: { liters: 2.5 } };
    expect(evaluateCondition(cond, { hydration_l: 2.5 })).toBe(true);
  });

  it('hydration_l_gte 2.5 => false when 2.0L', () => {
    const cond: QuestCondition = { type: 'hydration_l_gte', params: { liters: 2.5 } };
    expect(evaluateCondition(cond, { hydration_l: 2.0 })).toBe(false);
  });

  it('hydration_l_gte 2.5 => false when no hydration data', () => {
    const cond: QuestCondition = { type: 'hydration_l_gte', params: { liters: 2.5 } };
    expect(evaluateCondition(cond, {})).toBe(false);
  });

  it('workout_count_gte => false (TODO)', () => {
    const cond: QuestCondition = { type: 'workout_count_gte', params: { count: 3 } };
    expect(evaluateCondition(cond, fullLog)).toBe(false);
  });

  it('photo_with_tag => false (TODO)', () => {
    const cond: QuestCondition = { type: 'photo_with_tag', params: { tag: 'face' } };
    expect(evaluateCondition(cond, fullLog)).toBe(false);
  });
});
