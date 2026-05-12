import { type DailyLogInput, type Streak, type StreakCategory } from '@lifeos/shared';

function diffDays(a: string, b: string): number {
  const da = new Date(a + 'T00:00:00Z').getTime();
  const db = new Date(b + 'T00:00:00Z').getTime();
  return Math.round((db - da) / 86400_000);
}

export function recomputeStreaks(
  logs: { date: string; data: DailyLogInput }[],
): Record<'daily_log' | 'skincare_am' | 'skincare_pm', Streak> {
  const sorted = [...logs].sort((a, b) => a.date.localeCompare(b.date));
  const today = new Date().toISOString().slice(0, 10);

  function compute(predicate: (l: DailyLogInput) => boolean, cat: StreakCategory): Streak {
    let current = 0;
    let longest = 0;
    let prevDate: string | null = null;
    let lastEvent: string | undefined;

    for (const log of sorted) {
      if (!predicate(log.data)) {
        // not counted, breaks streak (continue without increment)
        continue;
      }
      if (prevDate == null || diffDays(prevDate, log.date) === 1) {
        current += 1;
      } else {
        current = 1;
      }
      longest = Math.max(longest, current);
      prevDate = log.date;
      lastEvent = log.date;
    }

    if (prevDate != null && diffDays(prevDate, today) > 1) {
      current = 0;
    }
    return { category: cat, current, longest, last_event_date: lastEvent };
  }

  return {
    daily_log: compute(() => true, 'daily_log'),
    skincare_am: compute((l) => !!l.skincare?.am, 'skincare_am'),
    skincare_pm: compute((l) => !!l.skincare?.pm, 'skincare_pm'),
  };
}
