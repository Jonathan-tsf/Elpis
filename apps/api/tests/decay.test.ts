import { describe, expect, it } from 'vitest';
import { computeActivity } from '../src/services/decay';
import type { StatName } from '@lifeos/shared';

const ALL_STATS: StatName[] = ['force', 'endurance', 'vitality', 'discipline', 'appearance', 'spirit'];

function daysAgo(days: number): number {
  // Use exact milliseconds to guarantee consistent daysSince calculation
  const d = new Date();
  return d.getTime() - days * 86_400_000;
}

describe('computeActivity', () => {
  it('all events today → all stats active, mode=active', () => {
    const today = new Date();
    const events = ALL_STATS.map((stat) => ({ ts: today.getTime(), stat }));
    const { activity, avatar_mode } = computeActivity(null, events, today);

    expect(avatar_mode).toBe('active');
    for (const stat of ALL_STATS) {
      expect(activity[stat].is_decaying).toBe(false);
      expect(activity[stat].decay_factor).toBe(1);
    }
  });

  it('events 5 days ago → all stats decaying with factor ~0.75', () => {
    const today = new Date();
    const events = ALL_STATS.map((stat) => ({ ts: daysAgo(5), stat }));
    const { activity, avatar_mode } = computeActivity(null, events, today);

    expect(avatar_mode).toBe('decaying');
    for (const stat of ALL_STATS) {
      expect(activity[stat].is_decaying).toBe(true);
      // daysSince=5, factor = max(0, 1 - (5-2)/12) = 1 - 3/12 = 0.75
      expect(activity[stat].decay_factor).toBeCloseTo(0.75, 5);
    }
  });

  it('no events at all → all stats decaying with factor 0, avatar dormant', () => {
    const today = new Date();
    const { activity, avatar_mode } = computeActivity(null, [], today);

    expect(avatar_mode).toBe('dormant');
    for (const stat of ALL_STATS) {
      expect(activity[stat].is_decaying).toBe(true);
      expect(activity[stat].decay_factor).toBe(0);
      expect(activity[stat].last_event_date).toBeUndefined();
    }
  });

  it('events 3 days ago → decaying mode, factor ~0.917', () => {
    const today = new Date();
    const events = ALL_STATS.map((stat) => ({ ts: daysAgo(3), stat }));
    const { activity, avatar_mode } = computeActivity(null, events, today);

    expect(avatar_mode).toBe('decaying');
    for (const stat of ALL_STATS) {
      expect(activity[stat].is_decaying).toBe(true);
      // daysSince=3, factor = 1 - (3-2)/12 = 1 - 1/12 ≈ 0.9167
      expect(activity[stat].decay_factor).toBeCloseTo(1 - 1 / 12, 5);
    }
  });

  it('events 14+ days ago → dormant mode, factor 0', () => {
    const today = new Date();
    const events = ALL_STATS.map((stat) => ({ ts: daysAgo(14), stat }));
    const { activity, avatar_mode } = computeActivity(null, events, today);

    expect(avatar_mode).toBe('dormant');
    for (const stat of ALL_STATS) {
      expect(activity[stat].decay_factor).toBe(0);
    }
  });

  it('mixed: only some stats have events → partial activity', () => {
    const today = new Date();
    const events = [
      { ts: today.getTime(), stat: 'force' as StatName },
      { ts: today.getTime(), stat: 'endurance' as StatName },
    ];
    const { activity, avatar_mode } = computeActivity(null, events, today);

    expect(avatar_mode).toBe('active'); // most recent overall = today
    expect(activity.force.is_decaying).toBe(false);
    expect(activity.endurance.is_decaying).toBe(false);
    expect(activity.vitality.is_decaying).toBe(true);
    expect(activity.discipline.is_decaying).toBe(true);
  });
});
