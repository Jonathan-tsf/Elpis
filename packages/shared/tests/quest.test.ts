import { describe, expect, it } from 'vitest';
import { Quest } from '../src/quest';

const validQuest = {
  id: 'q_abc',
  title: 'Morning Warrior',
  description: 'Complete skincare AM for 7 days',
  period: 'weekly' as const,
  condition: { type: 'skincare_am_done' as const },
  xp_reward: 200,
  stat_reward: 'discipline' as const,
  status: 'active' as const,
};

describe('Quest schemas', () => {
  it('accepts a valid Quest', () => {
    const result = Quest.parse(validQuest);
    expect(result.xp_reward).toBe(200);
  });

  it('rejects Quest with negative xp_reward', () => {
    expect(() => Quest.parse({ ...validQuest, xp_reward: -1 })).toThrow();
  });

  it('rejects Quest with invalid status', () => {
    expect(() => Quest.parse({ ...validQuest, status: 'pending' })).toThrow();
  });

  it('accepts Quest without optional fields', () => {
    const result = Quest.parse({
      id: 'q_min',
      title: 'Simple Quest',
      period: 'daily',
      condition: { type: 'daily_log_filled' },
      xp_reward: 50,
      status: 'active',
    });
    expect(result.id).toBe('q_min');
  });
});
