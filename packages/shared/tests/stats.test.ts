import { describe, expect, it } from 'vitest';
import { Stats, XpEvent } from '../src/stats';

const validStats = {
  global_level: 12,
  global_xp: 5400,
  per_stat: {
    force: { level: 10, xp: 800, xp_to_next: 200 },
    endurance: { level: 8, xp: 400, xp_to_next: 600 },
    vitality: { level: 9, xp: 300, xp_to_next: 700 },
    discipline: { level: 11, xp: 900, xp_to_next: 100 },
    appearance: { level: 7, xp: 200, xp_to_next: 800 },
    spirit: { level: 6, xp: 150, xp_to_next: 850 },
  },
  updated_at: 1715430000000,
};

describe('Stats schemas', () => {
  it('accepts a complete Stats object', () => {
    const result = Stats.parse(validStats);
    expect(result.global_level).toBe(12);
  });

  it('rejects per_stat with an unknown stat key', () => {
    expect(() =>
      Stats.parse({
        ...validStats,
        per_stat: {
          ...validStats.per_stat,
          unknown_stat: { level: 1, xp: 0, xp_to_next: 100 },
        },
      }),
    ).toThrow();
  });

  it('accepts a valid XpEvent', () => {
    const result = XpEvent.parse({
      id: 'xp_abc',
      ts: 1715430000000,
      source: 'workout',
      amount: 50,
      stat: 'force',
    });
    expect(result.amount).toBe(50);
  });
});
