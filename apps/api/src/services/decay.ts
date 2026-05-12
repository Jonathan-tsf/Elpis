import { type StatName, type Stats } from '@lifeos/shared';

export interface StatActivity {
  last_event_date?: string;
  is_decaying: boolean;
  decay_factor: number;
}

const STAT_NAMES: StatName[] = [
  'force',
  'endurance',
  'vitality',
  'discipline',
  'appearance',
  'spirit',
];

export function computeActivity(
  _stats: Stats | null,
  xpEvents: { ts: number; stat: StatName }[],
  today: Date,
): {
  activity: Record<StatName, StatActivity>;
  avatar_mode: 'active' | 'decaying' | 'dormant';
} {
  const activity = {} as Record<StatName, StatActivity>;
  let mostRecentDays = Infinity;

  for (const stat of STAT_NAMES) {
    const eventsForStat = xpEvents.filter((e) => e.stat === stat);
    const last =
      eventsForStat.length > 0
        ? eventsForStat.reduce((a, b) => (a.ts > b.ts ? a : b)).ts
        : null;
    const lastDate = last ? new Date(last) : null;
    const lastStr = lastDate?.toISOString().slice(0, 10);
    const daysSince = lastDate
      ? Math.floor((today.getTime() - lastDate.getTime()) / 86_400_000)
      : Infinity;
    if (daysSince < mostRecentDays) mostRecentDays = daysSince;

    const isDecaying = daysSince >= 3;
    // linear from 1.0 at d=2 to 0.0 at d=14
    const factor =
      daysSince <= 2 ? 1 : Math.max(0, 1 - (daysSince - 2) / 12);
    activity[stat] = { last_event_date: lastStr, is_decaying: isDecaying, decay_factor: factor };
  }

  const avatar_mode =
    mostRecentDays >= 14
      ? 'dormant'
      : mostRecentDays >= 3
        ? 'decaying'
        : 'active';

  return { activity, avatar_mode };
}
