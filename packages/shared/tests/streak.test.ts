import { describe, expect, it } from 'vitest';
import { Streak } from '../src/streak';

describe('Streak schemas', () => {
  it('accepts a valid streak', () => {
    const result = Streak.parse({
      category: 'daily_log',
      current: 7,
      longest: 14,
      last_event_date: '2026-05-11',
    });
    expect(result.current).toBe(7);
  });

  it('rejects streak with negative current', () => {
    expect(() =>
      Streak.parse({ category: 'daily_log', current: -1, longest: 0 }),
    ).toThrow();
  });

  it('rejects streak with invalid category', () => {
    expect(() =>
      Streak.parse({ category: 'unknown_cat', current: 0, longest: 0 }),
    ).toThrow();
  });

  it('accepts streak without optional last_event_date', () => {
    const result = Streak.parse({ category: 'skincare_am', current: 0, longest: 0 });
    expect(result.last_event_date).toBeUndefined();
  });
});
