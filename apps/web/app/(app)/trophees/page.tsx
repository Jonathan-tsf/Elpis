'use client';
import { useEffect, useState } from 'react';
import { Loader2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import type { Achievement } from '@lifeos/shared';

type AchievementWithStatus = Achievement & { unlocked: boolean; unlocked_at?: number };
type Category = Achievement['category'] | 'all';

const CATEGORY_LABELS: Record<Achievement['category'] | 'all', string> = {
  all: 'Tous',
  sleep: 'Sommeil',
  workout: 'Workout',
  looksmax: 'Looksmax',
  discipline: 'Discipline',
  global: 'Global',
  milestone: 'Jalons',
};

const CATEGORY_ORDER: (Achievement['category'] | 'all')[] = [
  'all', 'workout', 'sleep', 'discipline', 'looksmax', 'milestone', 'global',
];

export default function TropheesPage() {
  const [achievements, setAchievements] = useState<AchievementWithStatus[]>([]);
  const [total, setTotal] = useState(0);
  const [unlockedCount, setUnlockedCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [detecting, setDetecting] = useState(false);
  const [tab, setTab] = useState<Category>('all');

  const load = () => {
    setLoading(true);
    apiFetch<{ achievements: AchievementWithStatus[]; total: number; unlocked_count: number }>(
      '/achievements',
    )
      .then((res) => {
        setAchievements(res.achievements);
        setTotal(res.total);
        setUnlockedCount(res.unlocked_count);
      })
      .catch(() => toast.error('Erreur lors du chargement des trophées.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleDetect = async () => {
    setDetecting(true);
    try {
      const res = await apiFetch<{ newly_unlocked: string[] }>('/achievements/detect', {
        method: 'POST',
      });
      const n = res.newly_unlocked.length;
      if (n > 0) {
        toast.success(`+${n} nouveau${n > 1 ? 'x' : ''} trophée${n > 1 ? 's' : ''} débloqué${n > 1 ? 's' : ''} !`);
        load();
      } else {
        toast.info('Aucun nouveau trophée pour l\'instant.');
      }
    } catch {
      toast.error('Erreur lors de la vérification.');
    } finally {
      setDetecting(false);
    }
  };

  const filtered = tab === 'all' ? achievements : achievements.filter((a) => a.category === tab);
  const groups = tab === 'all'
    ? achievements.reduce<Record<string, AchievementWithStatus[]>>((acc, a) => {
        acc[a.category] = acc[a.category] ?? [];
        acc[a.category]!.push(a);
        return acc;
      }, {})
    : null;

  return (
    <div className="max-w-2xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Trophées</h1>
          {!loading && (
            <p className="text-xs text-text-muted mt-1">
              {unlockedCount} / {total} débloqués
            </p>
          )}
        </div>
        <button
          type="button"
          onClick={handleDetect}
          disabled={detecting}
          className="flex items-center gap-2 px-3 py-2 rounded-lg border border-bg-strong bg-bg-subtle text-sm text-text-DEFAULT hover:border-accent-discipline/50 transition-colors disabled:opacity-50"
        >
          {detecting ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
          Vérifier
        </button>
      </div>

      {/* Progress bar */}
      {!loading && total > 0 && (
        <div className="w-full h-2 rounded-full bg-bg-strong overflow-hidden">
          <div
            className="h-full rounded-full bg-accent-discipline transition-all duration-500"
            style={{ width: `${Math.round((unlockedCount / total) * 100)}%` }}
          />
        </div>
      )}

      {/* Category tabs */}
      <div className="flex flex-wrap gap-1 border-b border-bg-strong pb-2">
        {CATEGORY_ORDER.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setTab(cat)}
            className={`px-3 py-1.5 rounded-t text-xs font-medium transition-colors ${
              tab === cat
                ? 'border-b-2 border-accent-discipline text-accent-discipline'
                : 'text-text-muted hover:text-text-DEFAULT'
            }`}
          >
            {CATEGORY_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className="flex items-center justify-center h-40 text-text-muted">
          <Loader2 size={20} className="animate-spin" />
        </div>
      ) : groups ? (
        // "All" view — grouped by category
        <div className="space-y-6">
          {(Object.keys(groups) as Achievement['category'][]).map((cat) => (
            <div key={cat}>
              <h2 className="text-xs font-display uppercase tracking-wider text-text-muted mb-3">
                {CATEGORY_LABELS[cat]}
              </h2>
              <AchievementGrid items={groups[cat]!} />
            </div>
          ))}
        </div>
      ) : (
        <AchievementGrid items={filtered} />
      )}
    </div>
  );
}

function AchievementGrid({ items }: { items: AchievementWithStatus[] }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      {items.map((a) => (
        <AchievementCard key={a.id} achievement={a} />
      ))}
    </div>
  );
}

function AchievementCard({ achievement: a }: { achievement: AchievementWithStatus }) {
  return (
    <div
      className={`rounded-lg border p-4 flex items-start gap-3 transition-all ${
        a.unlocked
          ? 'border-accent-discipline/40 bg-accent-discipline/5'
          : 'border-bg-strong bg-bg-subtle opacity-50 grayscale'
      }`}
    >
      <span className="text-2xl flex-shrink-0">{a.icon}</span>
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-DEFAULT">{a.title}</span>
          {a.xp_reward > 0 && (
            <span className="text-xs text-accent-xp font-mono">+{a.xp_reward} XP</span>
          )}
        </div>
        <p className="text-xs text-text-muted mt-0.5 leading-relaxed">{a.description}</p>
        {a.unlocked && a.unlocked_at && (
          <p className="text-xs text-accent-discipline/70 mt-1">
            {new Date(a.unlocked_at).toLocaleDateString('fr-FR')}
          </p>
        )}
      </div>
    </div>
  );
}
