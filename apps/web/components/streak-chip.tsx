'use client';
import type { Streak, StreakCategory } from '@lifeos/shared';

interface StreakChipProps {
  streak: Streak;
}

const categoryLabel: Record<StreakCategory, string> = {
  daily_log: 'Journal',
  skincare_am: 'Skincare AM',
  skincare_pm: 'Skincare PM',
  sleep_7h_plus: 'Sommeil 7h+',
  workout_weekly: 'Workout',
  hydration_target: 'Hydratation',
};

export function StreakChip({ streak }: StreakChipProps) {
  const active = streak.current > 0;
  return (
    <div
      className={`rounded-lg border px-4 py-3 flex items-center gap-3 ${
        active ? 'border-accent-streak/40 bg-accent-streak/5' : 'border-bg-strong bg-bg-subtle'
      }`}
    >
      <span className="text-2xl">{active ? '🔥' : '💤'}</span>
      <div>
        <div className="text-xs text-text-muted uppercase tracking-wide">
          {categoryLabel[streak.category] ?? streak.category}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-xl font-bold ${active ? 'text-accent-streak' : 'text-text-muted'}`}>
            {streak.current}
          </span>
          <span className="text-xs text-text-muted">jours</span>
        </div>
        {streak.longest > 0 && (
          <div className="text-xs text-text-muted">record: {streak.longest}</div>
        )}
      </div>
    </div>
  );
}
