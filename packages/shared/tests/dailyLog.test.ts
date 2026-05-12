import { describe, expect, it } from 'vitest';
import { DailyLog, DailyLogInput, SleepEntry, MoodEntry } from '../src/dailyLog';

describe('DailyLog schemas', () => {
  it('accepts a complete DailyLog payload', () => {
    const result = DailyLog.parse({
      date: '2026-05-11',
      updated_at: 1715430000000,
      sleep: { duration_min: 480, quality: 8, bedtime: '22:30', wake_time: '06:30' },
      mood: { mood: 7, energy: 6, focus: 8 },
      hydration_l: 2.5,
      skincare: { am: true, pm: true },
      supplements: [{ name: 'Vitamin D', dose: '2000 IU' }],
      meals: [{ slot: 'breakfast', description: 'Oats with berries', score: 4 }],
      notes: 'Good day overall',
    });
    expect(result.date).toBe('2026-05-11');
  });

  it('rejects DailyLogInput with invalid sleep duration > 1440', () => {
    expect(() =>
      SleepEntry.parse({ duration_min: 1441 }),
    ).toThrow();
  });

  it('rejects MoodEntry with mood = 11 (out of 1-10 range)', () => {
    expect(() =>
      MoodEntry.parse({ mood: 11, energy: 5, focus: 5 }),
    ).toThrow();
  });

  it('accepts minimal DailyLogInput (all fields optional)', () => {
    const result = DailyLogInput.parse({});
    expect(result).toEqual({});
  });
});
