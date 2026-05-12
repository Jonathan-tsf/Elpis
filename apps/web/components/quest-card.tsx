'use client';
import type { Quest } from '@lifeos/shared';
import type { StatName } from '@lifeos/shared';

interface QuestCardProps {
  quest: Quest;
}

const statDot: Record<StatName, string> = {
  force: 'bg-accent-force',
  endurance: 'bg-accent-endurance',
  vitality: 'bg-accent-vitality',
  discipline: 'bg-accent-discipline',
  appearance: 'bg-accent-appearance',
  spirit: 'bg-accent-spirit',
};

export function QuestCard({ quest }: QuestCardProps) {
  const done = quest.status === 'done';
  return (
    <div
      className={`rounded-lg border p-4 flex flex-col gap-2 transition-colors ${
        done
          ? 'border-accent-vitality/40 bg-accent-vitality/5'
          : 'border-bg-strong bg-bg-subtle'
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex-shrink-0">
          {done ? (
            <div className="w-5 h-5 rounded-full bg-accent-vitality flex items-center justify-center">
              <svg width="10" height="8" viewBox="0 0 10 8" fill="none">
                <path d="M1 4l3 3 5-6" stroke="#0d1117" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
          ) : (
            <div className="w-5 h-5 rounded-full border-2 border-text-muted" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium leading-snug ${done ? 'text-text-muted line-through' : 'text-text-DEFAULT'}`}>
            {quest.title}
          </p>
          {quest.description && (
            <p className="text-xs text-text-muted mt-0.5 truncate">{quest.description}</p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs font-mono text-accent-xp bg-accent-xp/10 px-2 py-0.5 rounded">
          +{quest.xp_reward} XP
        </span>
        {quest.stat_reward && (
          <span className="flex items-center gap-1 text-xs text-text-muted">
            <span className={`w-2 h-2 rounded-full ${statDot[quest.stat_reward]}`} />
            {quest.stat_reward}
          </span>
        )}
      </div>
    </div>
  );
}
