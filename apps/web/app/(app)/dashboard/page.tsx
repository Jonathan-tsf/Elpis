'use client';
import { useEffect, useState } from 'react';
import { User, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { currentUser } from '@/lib/auth';
import { StatBar } from '@/components/stat-bar';
import { QuestCard } from '@/components/quest-card';
import { StreakChip } from '@/components/streak-chip';
import { BriefingCard } from '@/components/briefing-card';
import type { Stats, Quest, Streak } from '@lifeos/shared';

interface StatsResponse {
  stats: Stats | null;
}

interface StreaksResponse {
  streaks: Streak[];
}

export default function DashboardPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [quests, setQuests] = useState<Quest[]>([]);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState(false);

  useEffect(() => {
    async function load() {
      try {
        const [user, statsRes, questsRes, streaksRes] = await Promise.allSettled([
          currentUser(),
          apiFetch<StatsResponse>('/stats'),
          apiFetch<Quest[]>('/quests'),
          apiFetch<StreaksResponse>('/streaks'),
        ]);

        if (user.status === 'fulfilled' && user.value) {
          setEmail(user.value.email ?? user.value.sub);
        }
        if (statsRes.status === 'fulfilled') {
          setStats(statsRes.value.stats);
        }
        if (questsRes.status === 'fulfilled') {
          setQuests(Array.isArray(questsRes.value) ? questsRes.value : []);
        }
        if (streaksRes.status === 'fulfilled') {
          setStreaks(streaksRes.value.streaks ?? []);
        }
        if (
          statsRes.status === 'rejected' &&
          questsRes.status === 'rejected' &&
          streaksRes.status === 'rejected'
        ) {
          setError('Impossible de charger les données.');
        }
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const handleRegenerateQuests = async () => {
    setRegenerating(true);
    try {
      const newQuests = await apiFetch<Quest[]>('/quests/regenerate', { method: 'POST' });
      setQuests(Array.isArray(newQuests) ? newQuests : []);
    } catch {
      // silently fail — quests remain unchanged
    } finally {
      setRegenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-text-muted">…</div>
    );
  }

  const globalXpPct =
    stats && stats.global_xp >= 0
      ? Math.min(100, Math.round(((stats.global_xp % 1000) / 1000) * 100))
      : 0;

  const statEntries = stats
    ? (Object.entries(stats.per_stat) as [string, { level: number; xp: number; xp_to_next: number }][])
    : [];

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 rounded-full bg-bg-strong border border-bg-strong flex items-center justify-center">
          <User size={22} className="text-accent-spirit" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="text-sm text-text-muted truncate">{email ?? '…'}</div>
          {stats && (
            <div className="flex items-center gap-3 mt-1">
              <span className="font-display text-accent-xp text-sm tracking-wider">
                NIVEAU {stats.global_level}
              </span>
              <div className="flex-1 max-w-[200px] h-2 rounded-full bg-bg-strong overflow-hidden">
                <div
                  className="h-full rounded-full bg-accent-xp transition-all"
                  style={{ width: `${globalXpPct}%` }}
                />
              </div>
              <span className="text-xs text-text-muted">{stats.global_xp} XP</span>
            </div>
          )}
        </div>
      </div>

      {error && (
        <div className="rounded border border-accent-force/40 bg-accent-force/5 p-3 text-sm text-accent-force">
          {error}
        </div>
      )}

      {/* Briefing */}
      <BriefingCard />

      {/* Quests */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase">
            Quêtes aujourd&apos;hui
          </h2>
          <button
            onClick={handleRegenerateQuests}
            disabled={regenerating}
            className="flex items-center gap-1.5 text-xs text-accent-spirit hover:text-accent-spirit/80 disabled:opacity-50 transition-opacity"
            title="Générer mes quêtes du jour avec l'IA"
          >
            <RefreshCw size={12} className={regenerating ? 'animate-spin' : ''} />
            Régénérer (IA)
          </button>
        </div>
        {quests.length === 0 ? (
          <p className="text-text-muted text-sm">Aucune quête active.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {quests.map((q) => (
              <QuestCard key={q.id} quest={q} />
            ))}
          </div>
        )}
      </section>

      {/* Stats */}
      {statEntries.length > 0 && (
        <section>
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-3">
            Stats
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {statEntries.map(([stat, data]) => (
              <div key={stat} className="bg-bg-subtle rounded-lg border border-bg-strong p-3">
                <StatBar
                  stat={stat as import('@lifeos/shared').StatName}
                  level={data.level}
                  xp={data.xp}
                  xpToNext={data.xp_to_next}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Streaks */}
      {streaks.length > 0 && (
        <section>
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-3">
            Séries
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {streaks.map((s) => (
              <StreakChip key={s.category} streak={s} />
            ))}
          </div>
        </section>
      )}

      {/* CTA Journal */}
      <Link
        href="/journal"
        className="block rounded-lg border border-bg-strong bg-bg-subtle hover:bg-bg-strong transition-colors p-6 text-center"
      >
        <div className="text-2xl mb-2">🎙️</div>
        <div className="font-display tracking-wider text-accent-spirit text-sm">
          Journal du soir
        </div>
        <div className="text-xs text-text-muted mt-1">
          Remplis ton journal quotidien
        </div>
      </Link>
    </div>
  );
}
