import { describe, expect, it } from 'vitest';
import {
  USER_PK,
  dailyLogKey,
  dateString,
  measurementKey,
  photoKey,
  profileKey,
  questKey,
  statsKey,
  streakKey,
  workoutExerciseKey,
  workoutKey,
  workoutSetKey,
  xpEventKey,
} from '../src/services/keys';

describe('keys', () => {
  it('USER_PK is correct', () => {
    expect(USER_PK).toBe('USER#me');
  });

  it('dailyLogKey', () => {
    const k = dailyLogKey('2024-01-15');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('DAY#2024-01-15');
  });

  it('workoutKey', () => {
    const k = workoutKey('2024-01-15', 'abc123');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('WORKOUT#2024-01-15#abc123');
  });

  it('workoutExerciseKey', () => {
    const k = workoutExerciseKey('wk-1', 2);
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('WEX#wk-1#2');
  });

  it('workoutSetKey', () => {
    const k = workoutSetKey('wk-1', 3, 5);
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('WSET#wk-1#3#5');
  });

  it('measurementKey', () => {
    const k = measurementKey('weight', '2024-01-15');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('MEAS#weight#2024-01-15');
  });

  it('photoKey', () => {
    const k = photoKey('2024-01-15', 'img-9');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('PHOTO#2024-01-15#img-9');
  });

  it('xpEventKey', () => {
    const k = xpEventKey(1700000000000, 'ev-7');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('XP#1700000000000#ev-7');
  });

  it('statsKey', () => {
    const k = statsKey();
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('STATS');
  });

  it('streakKey', () => {
    const k = streakKey('workout');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('STREAK#workout');
  });

  it('questKey', () => {
    const k = questKey('q-42');
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('QUEST#q-42');
  });

  it('profileKey', () => {
    const k = profileKey();
    expect(k.pk).toBe('USER#me');
    expect(k.sk).toBe('PROFILE');
  });

  it('dateString defaults to today in UTC YYYY-MM-DD format', () => {
    const result = dateString();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('dateString with a given date', () => {
    const d = new Date('2024-03-07T12:00:00Z');
    expect(dateString(d)).toBe('2024-03-07');
  });
});
