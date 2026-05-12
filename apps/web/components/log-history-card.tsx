'use client';
import { formatHumanDate } from '@/lib/dates';
import type { DailyLog } from '@lifeos/shared';

interface LogHistoryCardProps {
  log: DailyLog & { date: string };
}

export function LogHistoryCard({ log }: LogHistoryCardProps) {
  const sleepH = log.sleep ? Math.floor(log.sleep.duration_min / 60) : null;
  const sleepMin = log.sleep ? log.sleep.duration_min % 60 : null;
  const moodAvg =
    log.mood
      ? Math.round((log.mood.mood + log.mood.energy + log.mood.focus) / 3)
      : null;

  return (
    <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4 space-y-2">
      <div className="font-mono text-xs text-text-muted capitalize">
        {formatHumanDate(log.date)}
      </div>
      <div className="flex flex-wrap gap-3">
        {sleepH !== null && (
          <div className="text-xs bg-bg-strong rounded px-2 py-1">
            <span className="text-text-muted">😴 </span>
            <span className="text-accent-vitality font-semibold">
              {sleepH}h{sleepMin ? `${sleepMin}m` : ''}
            </span>
            {log.sleep?.quality != null && (
              <span className="text-text-muted ml-1">({log.sleep.quality}/10)</span>
            )}
          </div>
        )}
        {moodAvg !== null && (
          <div className="text-xs bg-bg-strong rounded px-2 py-1">
            <span className="text-text-muted">🧠 </span>
            <span className="text-accent-spirit font-semibold">{moodAvg}/10</span>
          </div>
        )}
        {log.hydration_l != null && (
          <div className="text-xs bg-bg-strong rounded px-2 py-1">
            <span className="text-text-muted">💧 </span>
            <span className="text-accent-discipline font-semibold">{log.hydration_l}L</span>
          </div>
        )}
        {log.skincare && (
          <div className="flex gap-1">
            {log.skincare.am && (
              <span className="text-xs bg-accent-appearance/10 text-accent-appearance rounded px-2 py-1">AM ✓</span>
            )}
            {log.skincare.pm && (
              <span className="text-xs bg-accent-appearance/10 text-accent-appearance rounded px-2 py-1">PM ✓</span>
            )}
          </div>
        )}
      </div>
      {log.notes && (
        <p className="text-xs text-text-muted line-clamp-2">{log.notes}</p>
      )}
    </div>
  );
}
