'use client';
import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, ChevronUp, Wand2, Plus, CheckCircle2, Circle, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import type { Season, SeasonInput, StatName } from '@lifeos/shared';

// ────────────────────────────────────────────────────────────────────────────
// helpers
// ────────────────────────────────────────────────────────────────────────────

function daysLeft(endDate: string): number {
  const today = new Date().toISOString().slice(0, 10);
  const diff = new Date(endDate).getTime() - new Date(today).getTime();
  return Math.max(0, Math.ceil(diff / 86_400_000));
}

function defaultDateRange(): { start: string; end: string } {
  const start = new Date();
  const end = new Date(start);
  end.setMonth(end.getMonth() + 3);
  return { start: start.toISOString().slice(0, 10), end: end.toISOString().slice(0, 10) };
}

const STATS: { value: StatName; label: string; color: string }[] = [
  { value: 'force', label: 'Force', color: 'text-accent-force' },
  { value: 'endurance', label: 'Endurance', color: 'text-accent-endurance' },
  { value: 'vitality', label: 'Vitalité', color: 'text-accent-vitality' },
  { value: 'discipline', label: 'Discipline', color: 'text-accent-discipline' },
  { value: 'appearance', label: 'Apparence', color: 'text-accent-appearance' },
  { value: 'spirit', label: 'Esprit', color: 'text-accent-spirit' },
];

function reportError(label: string, e: unknown) {
  // eslint-disable-next-line no-console
  console.error('[saison]', label, e);
  toast.error(`${label} : ${e instanceof Error ? e.message : String(e)}`);
}

function StatBadge({ stat }: { stat?: StatName }) {
  if (!stat) return null;
  const meta = STATS.find((s) => s.value === stat);
  if (!meta) return null;
  return <span className={`text-[10px] uppercase tracking-wider ${meta.color}`}>{meta.label}</span>;
}

// ────────────────────────────────────────────────────────────────────────────
// Active season view
// ────────────────────────────────────────────────────────────────────────────

function ActiveSeasonView({ season, onChange }: { season: Season; onChange: () => void }) {
  const [ending, setEnding] = useState(false);
  const [completingId, setCompletingId] = useState<string | null>(null);

  const completeQuest = async (questId: string) => {
    setCompletingId(questId);
    try {
      await apiFetch(`/seasons/${season.id}/quests/${questId}/complete`, { method: 'POST' });
      toast.success('Quête accomplie !');
      onChange();
    } catch (e) {
      reportError('Échec validation quête', e);
    } finally {
      setCompletingId(null);
    }
  };

  const endSeason = async () => {
    if (!confirm('Terminer cette saison et générer un récap IA ? (~30s)')) return;
    setEnding(true);
    try {
      await apiFetch(`/seasons/${season.id}/end`, { method: 'POST' });
      toast.success('Saison terminée, récap généré.');
      onChange();
    } catch (e) {
      reportError('Échec fin de saison', e);
    } finally {
      setEnding(false);
    }
  };

  const remaining = daysLeft(season.end_date);
  const doneCount = season.quests.filter((q) => q.done).length;
  const progress = season.quests.length > 0 ? Math.round((doneCount / season.quests.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="rounded-lg border border-accent-spirit/30 bg-bg-subtle p-6">
        <div className="flex items-start justify-between gap-3 mb-3">
          <h1 className="font-display tracking-wider text-2xl text-accent-spirit">{season.name}</h1>
          <span className="shrink-0 text-xs text-text-muted font-mono">
            {season.start_date} → {season.end_date}
          </span>
        </div>
        <div className="flex items-center gap-4 text-xs">
          <span className="text-accent-xp font-display tracking-wider">
            {remaining} jour{remaining !== 1 ? 's' : ''} restant{remaining !== 1 ? 's' : ''}
          </span>
          <div className="flex items-center gap-2">
            <div className="w-32 h-1.5 bg-bg-strong rounded-full overflow-hidden">
              <div className="h-full bg-accent-spirit" style={{ width: `${progress}%` }} />
            </div>
            <span className="text-text-muted">
              {doneCount}/{season.quests.length} quêtes
            </span>
          </div>
        </div>
      </div>

      {/* Main objective */}
      <div className="rounded-lg border border-bg-strong bg-bg-subtle p-5">
        <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-2">
          🎯 Objectif principal
        </h2>
        <p className="text-base leading-relaxed">{season.main_objective}</p>
      </div>

      {/* Quests */}
      {season.quests.length > 0 ? (
        <div>
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-3">
            📜 Quêtes de saison
          </h2>
          <div className="space-y-2">
            {season.quests.map((q) => (
              <div
                key={q.id}
                className="flex items-start gap-3 p-3 rounded-lg border border-bg-strong bg-bg-subtle"
              >
                <button
                  onClick={q.done ? undefined : () => completeQuest(q.id)}
                  disabled={q.done || completingId === q.id}
                  className="mt-0.5 shrink-0 disabled:cursor-default"
                >
                  {completingId === q.id ? (
                    <Loader2 size={18} className="animate-spin text-accent-xp" />
                  ) : q.done ? (
                    <CheckCircle2 size={18} className="text-accent-xp" />
                  ) : (
                    <Circle size={18} className="text-text-muted hover:text-accent-spirit" />
                  )}
                </button>
                <div className="flex-1 min-w-0">
                  <div className={`text-sm font-medium ${q.done ? 'line-through text-text-muted' : ''}`}>
                    {q.title}
                  </div>
                  {q.description && (
                    <div className="text-xs text-text-muted mt-0.5">{q.description}</div>
                  )}
                  <div className="flex items-center gap-3 mt-1.5">
                    <span className="text-xs text-accent-xp">+{q.xp_reward.toLocaleString()} XP</span>
                    <StatBadge stat={q.stat_reward} />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-lg border border-bg-strong bg-bg-subtle p-5 text-sm text-text-muted">
          Aucune quête définie pour cette saison.
        </div>
      )}

      {/* Rewards */}
      {season.rewards && season.rewards.length > 0 && (
        <div>
          <h2 className="font-display tracking-widest text-xs text-text-muted uppercase mb-3">
            🏆 Récompenses
          </h2>
          <div className="space-y-2">
            {season.rewards.map((r, i) => (
              <div
                key={i}
                className="p-3 rounded-lg border border-accent-xp/20 bg-accent-xp/5 text-sm"
              >
                <div className="font-medium text-accent-xp">{r.title}</div>
                {r.description && (
                  <div className="text-xs text-text-muted mt-0.5">{r.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        onClick={endSeason}
        disabled={ending}
        className="flex items-center gap-2 rounded-lg border border-accent-force/40 bg-accent-force/5 text-accent-force text-sm px-4 py-2 hover:bg-accent-force/10 transition-colors disabled:opacity-50"
      >
        {ending && <Loader2 size={14} className="animate-spin" />}
        Terminer la saison
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Wizard — manual + AI generate
// ────────────────────────────────────────────────────────────────────────────

type DraftQuest = {
  id: string;
  title: string;
  description?: string;
  xp_reward: number;
  stat_reward?: StatName;
  done: boolean;
  condition: { type: string; params?: Record<string, unknown> };
};

interface Draft {
  name: string;
  main_objective: string;
  start_date: string;
  end_date: string;
  quests: DraftQuest[];
  rewards?: { title: string; description?: string }[];
}

function makeEmptyDraft(start: string, end: string): Draft {
  return {
    name: `Saison ${start.slice(0, 7)}`,
    main_objective: '',
    start_date: start,
    end_date: end,
    quests: [],
    rewards: [],
  };
}

function newQuest(): DraftQuest {
  return {
    id: crypto.randomUUID(),
    title: '',
    description: '',
    xp_reward: 500,
    stat_reward: 'discipline',
    done: false,
    condition: { type: 'manual' },
  };
}

function NewSeasonWizard({ onCreated }: { onCreated: () => void }) {
  const { start, end } = defaultDateRange();
  const [draft, setDraft] = useState<Draft>(makeEmptyDraft(start, end));
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await apiFetch<Draft>('/seasons/generate', {
        method: 'POST',
        body: JSON.stringify({ start_date: draft.start_date, end_date: draft.end_date }),
      });
      // ensure each quest has an id (backend may omit)
      const withIds: DraftQuest[] = (result.quests ?? []).map((q) => ({
        ...q,
        id: q.id ?? crypto.randomUUID(),
        done: q.done ?? false,
      }));
      setDraft({ ...result, quests: withIds });
      toast.success('Draft IA généré, ajuste si besoin.');
    } catch (e) {
      reportError('Échec génération IA', e);
    } finally {
      setGenerating(false);
    }
  };

  const handleCreate = async () => {
    if (!draft.name.trim()) {
      toast.error('Donne un nom à la saison');
      return;
    }
    if (!draft.main_objective.trim()) {
      toast.error('Définis un objectif principal');
      return;
    }
    setCreating(true);
    try {
      const input: SeasonInput = {
        name: draft.name,
        main_objective: draft.main_objective,
        start_date: draft.start_date,
        end_date: draft.end_date,
        quests: draft.quests as SeasonInput['quests'],
        rewards: draft.rewards,
      };
      await apiFetch('/seasons', {
        method: 'POST',
        body: JSON.stringify(input),
      });
      toast.success('Saison démarrée 🚀');
      onCreated();
    } catch (e) {
      reportError('Échec création saison', e);
    } finally {
      setCreating(false);
    }
  };

  const updateQuest = (i: number, patch: Partial<DraftQuest>) => {
    const next = [...draft.quests];
    next[i] = { ...next[i]!, ...patch };
    setDraft({ ...draft, quests: next });
  };

  const labelCls = 'text-xs text-text-muted font-display tracking-wider uppercase mb-1 block';
  const inputCls =
    'w-full rounded border border-bg-strong bg-bg-subtle text-sm px-3 py-2 focus:outline-none focus:border-accent-spirit';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display tracking-wider text-2xl mb-1">Nouvelle saison</h1>
        <p className="text-text-muted text-sm">
          Définis une période (typiquement 3 mois) avec un objectif principal et des quêtes
          ambitieuses. Tu peux remplir à la main ou laisser l&apos;IA proposer un draft.
        </p>
      </div>

      {/* Date range */}
      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div>
          <label className={labelCls}>Début</label>
          <input
            type="date"
            value={draft.start_date}
            onChange={(e) => setDraft({ ...draft, start_date: e.target.value })}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Fin</label>
          <input
            type="date"
            value={draft.end_date}
            onChange={(e) => setDraft({ ...draft, end_date: e.target.value })}
            className={inputCls}
          />
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          onClick={handleGenerate}
          disabled={generating}
          className="flex items-center gap-2 rounded-lg bg-accent-spirit/10 border border-accent-spirit/30 text-accent-spirit text-sm px-4 py-2 hover:bg-accent-spirit/20 transition-colors disabled:opacity-50"
        >
          {generating ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
          Générer avec l&apos;IA
        </button>
        <span className="text-xs text-text-muted self-center">
          — ou remplis manuellement ci-dessous —
        </span>
      </div>

      {/* Manual / editable form */}
      <div className="space-y-4 rounded-lg border border-bg-strong bg-bg-subtle p-5">
        <div>
          <label className={labelCls}>Nom de la saison</label>
          <input
            type="text"
            value={draft.name}
            onChange={(e) => setDraft({ ...draft, name: e.target.value })}
            placeholder="Saison Force 2026 Q2"
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Objectif principal</label>
          <textarea
            value={draft.main_objective}
            onChange={(e) => setDraft({ ...draft, main_objective: e.target.value })}
            rows={3}
            placeholder="Ex : Atteindre 100kg au DC, perdre 4kg de gras, finir 90 jours skincare AM/PM."
            className={`${inputCls} resize-none`}
          />
        </div>

        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-text-muted font-display tracking-wider uppercase">
              Quêtes de saison ({draft.quests.length})
            </span>
            <button
              type="button"
              onClick={() => setDraft({ ...draft, quests: [...draft.quests, newQuest()] })}
              className="flex items-center gap-1 text-xs text-accent-spirit hover:opacity-80"
            >
              <Plus size={12} />
              Ajouter
            </button>
          </div>
          <div className="space-y-3">
            {draft.quests.map((q, i) => (
              <div
                key={q.id}
                className="rounded border border-bg-strong bg-bg-DEFAULT p-3 space-y-2"
              >
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={q.title}
                    onChange={(e) => updateQuest(i, { title: e.target.value })}
                    placeholder="Titre de la quête"
                    className={`flex-1 ${inputCls}`}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({ ...draft, quests: draft.quests.filter((_, j) => j !== i) })
                    }
                    className="text-text-muted hover:text-accent-force p-2"
                    title="Supprimer"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <textarea
                  value={q.description ?? ''}
                  onChange={(e) => updateQuest(i, { description: e.target.value })}
                  placeholder="Description (optionnel)"
                  rows={2}
                  className={`${inputCls} resize-none text-xs`}
                />
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[10px] text-text-muted">XP récompense</label>
                    <input
                      type="number"
                      value={q.xp_reward}
                      onChange={(e) => updateQuest(i, { xp_reward: Number(e.target.value) })}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-text-muted">Stat boostée</label>
                    <select
                      value={q.stat_reward ?? ''}
                      onChange={(e) =>
                        updateQuest(i, { stat_reward: (e.target.value || undefined) as StatName | undefined })
                      }
                      className={inputCls}
                    >
                      <option value="">— aucune —</option>
                      {STATS.map((s) => (
                        <option key={s.value} value={s.value}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>
            ))}
            {draft.quests.length === 0 && (
              <div className="text-xs text-text-muted py-3">
                Aucune quête. Génère avec l&apos;IA ou clique sur &quot;Ajouter&quot;.
              </div>
            )}
          </div>
        </div>
      </div>

      <button
        onClick={handleCreate}
        disabled={creating}
        className="w-full flex items-center justify-center gap-2 rounded-lg bg-accent-xp text-bg-DEFAULT font-bold py-3 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {creating ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
        Démarrer la saison
      </button>
    </div>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Past seasons accordion
// ────────────────────────────────────────────────────────────────────────────

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
        {open ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-bg-strong">
          <p className="text-sm text-text-muted pt-3">{season.main_objective}</p>
          {season.recap_markdown && (
            <pre className="text-xs whitespace-pre-wrap bg-bg-DEFAULT rounded p-3 border border-bg-strong">
              {season.recap_markdown}
            </pre>
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

// ────────────────────────────────────────────────────────────────────────────
// Page
// ────────────────────────────────────────────────────────────────────────────

export default function SaisonPage() {
  const [loading, setLoading] = useState(true);
  const [currentSeason, setCurrentSeason] = useState<Season | null>(null);
  const [pastSeasons, setPastSeasons] = useState<Season[]>([]);
  const [pastOpen, setPastOpen] = useState(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [current, all] = await Promise.allSettled([
        apiFetch<Season | null>('/seasons/current'),
        apiFetch<Season[] | { items: Season[] }>('/seasons'),
      ]);
      if (current.status === 'fulfilled') setCurrentSeason(current.value);
      else setCurrentSeason(null);
      if (all.status === 'fulfilled') {
        const list = Array.isArray(all.value)
          ? all.value
          : Array.isArray((all.value as { items?: Season[] }).items)
            ? (all.value as { items: Season[] }).items
            : [];
        setPastSeasons(list.filter((s) => s.status === 'ended'));
      } else {
        setPastSeasons([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

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
        <ActiveSeasonView season={currentSeason} onChange={loadData} />
      ) : (
        <NewSeasonWizard onCreated={loadData} />
      )}

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
