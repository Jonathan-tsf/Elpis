'use client';
import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, Wand2, Plus, CheckCircle2, Circle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import type { Season, SeasonInput } from '@lifeos/shared';

// ---- helpers ----

function daysLeft(endDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const diff = new Date(endDate).getTime() - new Date(today).getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function defaultDateRange(): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10),
  };
}

// ---- sub-components ----

function SeasonQuestRow({
  quest,
  seasonId,
  onComplete,
}: {
  quest: Season['quests'][0];
  seasonId: string;
  onComplete: () => void;
}) {
  const [completing, setCompleting] = useState(false);

  const handleComplete = async () => {
    setCompleting(true);
    try {
      await apiFetch(`/seasons/${seasonId}/quests/${quest.id}/complete`, { method: 'POST' });
      onComplete();
    } catch {
      // silently fail
    } finally {
      setCompleting(false);
    }
  };

  return (
    <div className="flex items-start gap-3 p-3 rounded-lg border border-bg-strong bg-bg-subtle">
      <button
        onClick={quest.done ? undefined : handleComplete}
        disabled={quest.done || completing}
        className="mt-0.5 shrink-0 disabled:cursor-default"
        title={quest.done ? 'Accomplie' : 'Marquer comme accomplie'}
      >
        {completing ? (
          <Loader2 size={18} className="animate-spin text-accent-xp" />
        ) : quest.done ? (
          <CheckCircle2 size={18} className="text-accent-xp" />
        ) : (
          <Circle size={18} className="text-text-muted hover:text-accent-spirit transition-colors" />
        )}
      </button>
      <div className="flex-1 min-w-0">
        <div className={`text-sm font-medium ${quest.done ? 'line-through text-text-muted' : ''}`}>
          {quest.title}
        </div>
        {quest.description && (
          <div className="text-xs text-text-muted mt-0.5">{quest.description}</div>
        )}
        <div className="text-xs text-accent-xp mt-1">{quest.xp_reward.toLocaleString()} XP</div>
      </div>
    </div>
  );
}

function ActiveSeasonView({ season, onEnd }: { season: Season; onEnd: () => void }) {
  const [ending, setEnding] = useState(false);
  const [currentSeason, setCurrentSeason] = useState<Season>(season);

  const reloadSeason = async () => {
    try {
      const updated = await apiFetch<Season>(`/seasons/${season.id}`);
      setCurrentSeason(updated);
    } catch {
      // ignore
    }
  };

  const handleEnd = async () => {
    if (!confirm('Terminer cette saison et générer un récap IA ?')) return;
    setEnding(true);
    try {
      await apiFetch(`/seasons/${season.id}/end`, { method: 'POST' });
      onEnd();
    } catch {
      // ignore
    } finally {
      setEnding(false);
    }
  };

  const remaining = daysLeft(currentSeason.end_date);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <div className="rounded-lg border border-accent-spirit/30 bg-bg-subtle p-6 space-y-2">
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display tracking-wider text-xl text-accent-spirit">
            {currentSeason.name}
          </h1>
          <span className="shrink-0 text-xs text-text-muted font-mono">
            {currentSeason.start_date} → {currentSeason.end_date}
          </span>
        </div>
        <div className="text-xs text-accent-xp font-display tracking-wider">
          {remaining} jour{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Main objective */}
      <div className="rounded-lg border border-bg-strong bg-bg-subtle p-5">
        <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-2">
          Objectif principal
        </h2>
        <p className="text-sm leading-relaxed">{currentSeason.main_objective}</p>
      </div>

      {/* Season quests */}
      {currentSeason.quests.length > 0 && (
        <div>
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-3">
            Quêtes de saison
          </h2>
          <div className="space-y-2">
            {currentSeason.quests.map((q) => (
              <SeasonQuestRow
                key={q.id}
                quest={q}
                seasonId={currentSeason.id}
                onComplete={reloadSeason}
              />
            ))}
          </div>
        </div>
      )}

      {/* Rewards */}
      {currentSeason.rewards && currentSeason.rewards.length > 0 && (
        <div>
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-3">
            Récompenses
          </h2>
          <div className="space-y-2">
            {currentSeason.rewards.map((r, i) => (
              <div key={i} className="p-3 rounded-lg border border-accent-xp/20 bg-accent-xp/5 text-sm">
                <div className="font-medium text-accent-xp">{r.title}</div>
                {r.description && (
                  <div className="text-xs text-text-muted mt-0.5">{r.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* End button */}
      <button
        onClick={handleEnd}
        disabled={ending}
        className="flex items-center gap-2 rounded-lg border border-accent-force/40 bg-accent-force/5 text-accent-force text-sm px-4 py-2 hover:bg-accent-force/10 transition-colors disabled:opacity-50"
      >
        {ending && <Loader2 size={14} className="animate-spin" />}
        Terminer la saison
      </button>
    </div>
  );
}

interface AiDraft {
  name: string;
  main_objective: string;
  start_date: string;
  end_date: string;
  quests: Season['quests'];
  rewards?: Season['rewards'];
}

function NewSeasonWizard({ onCreated }: { onCreated: () => void }) {
  const { start, end } = defaultDateRange();
  const [startDate, setStartDate] = useState(start);
  const [endDate, setEndDate] = useState(end);
  const [generating, setGenerating] = useState(false);
  const [draft, setDraft] = useState<AiDraft | null>(null);
  const [creating, setCreating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await apiFetch<AiDraft>('/seasons/generate', {
        method: 'POST',
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });
      setDraft(result);
    } catch {
      // ignore
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!draft) return;
    setCreating(true);
    try {
      const input: SeasonInput = {
        name: draft.name,
        main_objective: draft.main_objective,
        start_date: draft.start_date,
        end_date: draft.end_date,
        quests: draft.quests,
        rewards: draft.rewards,
      };
      await apiFetch('/seasons', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      onCreated();
    } catch {
      // ignore
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display tracking-wider text-xl mb-1">Nouvelle saison</h1>
        <p className="text-text-muted text-sm">
          Définis une période de 3 mois avec un objectif principal et des quêtes ambitieuses.
        </p>
      </div>

      {/* Date range */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted font-display tracking-wider uppercase">
            Début
          </label>
          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="rounded border border-bg-strong bg-bg-subtle text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit"
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-xs text-text-muted font-display tracking-wider uppercase">
            Fin
          </label>
          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="rounded border border-bg-strong bg-bg-subtle text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit"
          />
        </div>
      </div>

      {/* Generate button */}
      <button
        onClick={handleGenerate}
        disabled={generating || !startDate || !endDate}
        className="flex items-center gap-2 rounded-lg bg-accent-spirit/10 border border-accent-spirit/30 text-accent-spirit text-sm px-4 py-2 hover:bg-accent-spirit/20 transition-colors disabled:opacity-50"
      >
        {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
        Générer avec l&apos;IA
      </button>

      {/* Draft preview / editable */}
      {draft && (
        <div className="space-y-4 border border-bg-strong rounded-lg p-5 bg-bg-subtle">
          <div>
            <label className="text-xs text-text-muted font-display tracking-wider uppercase mb-1 block">
              Nom de la saison
            </label>
            <input
              type="text"
              value={draft.name}
              onChange={(e) => setDraft({ ...draft, name: e.target.value })}
              className="w-full rounded border border-bg-strong bg-bg-DEFAULT text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit"
            />
          </div>
          <div>
            <label className="text-xs text-text-muted font-display tracking-wider uppercase mb-1 block">
              Objectif principal
            </label>
            <textarea
              value={draft.main_objective}
              onChange={(e) => setDraft({ ...draft, main_objective: e.target.value })}
              rows={3}
              className="w-full rounded border border-bg-strong bg-bg-DEFAULT text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit resize-none"
            />
          </div>
          <div>
            <h3 className="text-xs text-text-muted font-display tracking-wider uppercase mb-2">
              Quêtes de saison
            </h3>
            <div className="space-y-2">
              {draft.quests.map((q, i) => (
                <div key={q.id} className="flex gap-2 items-start">
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => {
                      const newQuests = [...draft.quests];
                      newQuests[i] = { ...q, title: e.target.value };
                      setDraft({ ...draft, quests: newQuests });
                    }}
                    className="flex-1 rounded border border-bg-strong bg-bg-DEFAULT text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit"
                    placeholder="Titre de la quête"
                  />
                  <span className="text-xs text-accent-xp pt-2 shrink-0">
                    {q.xp_reward.toLocaleString()} XP
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            onClick={handleCreate}
            disabled={creating}
            className="flex items-center gap-2 rounded-lg bg-accent-xp/10 border border-accent-xp/30 text-accent-xp text-sm px-4 py-2 hover:bg-accent-xp/20 transition-colors disabled:opacity-50"
          >
            {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
            Démarrer la saison
          </button>
        </div>
      )}
    </div>
  );
}

function PastSeasonCard({ season }: { season: Season }) {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border border-bg-strong bg-bg-subtle overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm hover:bg-bg-strong transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-medium">{season.name}</span>
          <span className="text-xs text-text-muted font-mono">
            {season.start_date} → {season.end_date}
          </span>
        </div>
        {open ? (
          <ChevronUp size={16} className="text-text-muted" />
        ) : (
          <ChevronDown size={16} className="text-text-muted" />
        )}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-bg-strong">
          <p className="text-sm text-text-muted pt-3">{season.main_objective}</p>
          {season.recap_markdown && (
            <div className="prose prose-sm prose-invert max-w-none">
              <pre className="text-xs text-text-DEFAULT whitespace-pre-wrap bg-bg-DEFAULT rounded p-3 border border-bg-strong">
                {season.recap_markdown}
              </pre>
            </div>
          )}
          {season.quests.length > 0 && (
            <div className="space-y-1">
              {season.quests.map((q) => (
                <div key={q.id} className="flex items-center gap-2 text-xs">
                  {q.done ? (
                    <CheckCircle2 size={13} className="text-accent-xp shrink-0" />
                  ) : (
                    <Circle size={13} className="text-text-muted shrink-0" />
                  )}
                  <span className={q.done ? '' : 'text-text-muted'}>{q.title}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- Main page ----

export default function SaisonPage() {
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState<Season | null | undefined>(undefined);
  const [pastSeasons, setPastSeasons] = useState<Season[]>([]);
  const [pastOpen, setPastOpen] = useState(false);

  const loadData = async () => {
    try {
      const [current, all] = await Promise.allSettled([
        apiFetch<Season | null>('/seasons/current'),
        apiFetch<Season[]>('/seasons'),
      ]);
      if (current.status === 'fulfilled') setCurrentSeason(current.value);
      else setCurrentSeason(null);
      if (all.status === 'fulfilled') {
        const list = Array.isArray(all.value) ? all.value : [];
        setPastSeasons(list.filter((s) => s.status === 'ended'));
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const reload = () => {
    setLoading(true);
    setCurrentSeason(undefined);
    loadData();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] text-text-muted">
        <Loader2 size={24} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-10 max-w-3xl">
      {currentSeason ? (
        <ActiveSeasonView season={currentSeason} onEnd={reload} />
      ) : (
        <NewSeasonWizard onCreated={reload} />
      )}

      {/* Past seasons */}
      {pastSeasons.length > 0 && (
        <div>
          <button
            onClick={() => setPastOpen((v) => !v)}
            className="flex items-center gap-2 text-xs text-text-muted font-display tracking-widest uppercase mb-3 hover:text-text-DEFAULT transition-colors"
          >
            {pastOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            Saisons précédentes ({pastSeasons.length})
          </button>
          {pastOpen && (
            <div className="space-y-2">
              {pastSeasons.map((s) => (
                <PastSeasonCard key={s.id} season={s} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
