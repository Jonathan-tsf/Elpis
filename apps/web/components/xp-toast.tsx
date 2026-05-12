'use client';
import { toast } from 'sonner';
import type { StatName } from '@lifeos/shared';

export type XpDelta = { stat: StatName; amount: number; reason: string };

const statColor: Record<StatName, string> = {
  force: 'text-accent-force',
  endurance: 'text-accent-endurance',
  vitality: 'text-accent-vitality',
  discipline: 'text-accent-discipline',
  appearance: 'text-accent-appearance',
  spirit: 'text-accent-spirit',
};

export function showXpToast(deltas: XpDelta[], totalXp: number) {
  toast.custom(() => (
    <div className="bg-bg-subtle border border-bg-strong rounded-lg px-4 py-3 shadow-lg min-w-[220px]">
      <div className="text-accent-xp font-bold text-lg mb-1">+{totalXp} XP</div>
      <ul className="space-y-0.5">
        {deltas.map((d, i) => (
          <li key={i} className="flex items-center gap-2 text-xs">
            <span className={statColor[d.stat] ?? 'text-text-muted'}>
              {d.stat}
            </span>
            <span className="text-text-muted">+{d.amount}</span>
            <span className="text-text-muted truncate">{d.reason}</span>
          </li>
        ))}
      </ul>
    </div>
  ));
}
