'use client';
import type { StatName } from '@lifeos/shared';

interface StatBarProps {
  stat: StatName;
  level: number;
  xp: number;
  xpToNext: number;
}

const statColors: Record<StatName, { bar: string; text: string }> = {
  force: { bar: 'bg-accent-force', text: 'text-accent-force' },
  endurance: { bar: 'bg-accent-endurance', text: 'text-accent-endurance' },
  vitality: { bar: 'bg-accent-vitality', text: 'text-accent-vitality' },
  discipline: { bar: 'bg-accent-discipline', text: 'text-accent-discipline' },
  appearance: { bar: 'bg-accent-appearance', text: 'text-accent-appearance' },
  spirit: { bar: 'bg-accent-spirit', text: 'text-accent-spirit' },
};

const statLabels: Record<StatName, string> = {
  force: 'FORCE',
  endurance: 'ENDURANCE',
  vitality: 'VITALITÉ',
  discipline: 'DISCIPLINE',
  appearance: 'APPARENCE',
  spirit: 'ESPRIT',
};

export function StatBar({ stat, level, xp, xpToNext }: StatBarProps) {
  const colors = statColors[stat];
  const pct = xpToNext > 0 ? Math.min(100, Math.round((xp / xpToNext) * 100)) : 100;

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className={`font-mono font-bold ${colors.text}`}>{statLabels[stat]}</span>
        <span className="text-text-muted">
          Niv. <span className="text-text-DEFAULT font-semibold">{level}</span>
        </span>
      </div>
      <div className="h-2 rounded-full bg-bg-strong overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${colors.bar}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="text-xs text-text-muted text-right">
        {xp} / {xpToNext} XP
      </div>
    </div>
  );
}
