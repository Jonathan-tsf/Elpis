'use client';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { todayStr, shiftDate, formatHumanDate } from '@/lib/dates';
import { showXpToast, type XpDelta } from '@/components/xp-toast';
import { AnalyseButton } from '@/components/analyse-button';
import type { Workout, PerfTest, PerfTestType } from '@lifeos/shared';

// ─── Local form schema ────────────────────────────────────────────────────────

const SetSchema = z.object({
  reps: z.coerce.number().int().min(0).max(500),
  weight_kg: z.coerce.number().min(0).max(1000).optional(),
  rpe: z.coerce.number().min(1).max(10).optional(),
});

const ExerciseSchema = z.object({
  name: z.string().min(1).max(80),
  sets: z.array(SetSchema).min(1),
});

const WorkoutFormSchema = z.object({
  date: z.string().min(1),
  type: z.enum(['push', 'pull', 'legs', 'upper', 'lower', 'full', 'cardio', 'mobility', 'other']),
  duration_min: z.coerce.number().int().min(0).max(600).optional(),
  rpe: z.coerce.number().min(1).max(10).optional(),
  exercises: z.array(ExerciseSchema),
  notes: z.string().max(2000).optional(),
});

type WorkoutFormValues = z.infer<typeof WorkoutFormSchema>;

interface PostWorkoutResponse {
  id: string;
  xp_deltas: XpDelta[];
  stats: { global_level: number; global_xp: number };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded bg-bg-strong border border-bg-strong focus:border-accent-endurance/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted';

const labelCls = 'text-xs text-text-muted uppercase tracking-wide';

function cls(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display tracking-widest text-xs text-accent-endurance uppercase border-b border-bg-strong pb-1 mb-3">
      {children}
    </h3>
  );
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function SportPage() {
  const [tab, setTab] = useState<'new' | 'history' | 'perf' | 'programme'>('new');
  const [xpFloater, setXpFloater] = useState<{ total: number; key: number } | null>(null);
  const today = todayStr();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Sport</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-mono">{formatHumanDate(today)}</span>
          <AnalyseButton scope="workouts" days={90} />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bg-strong">
        {([
          ['new', 'Nouvelle séance'],
          ['history', 'Historique'],
          ['perf', 'Tests de perf'],
          ['programme', 'Programme'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={cls(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === key
                ? 'border-accent-endurance text-accent-endurance'
                : 'border-transparent text-text-muted hover:text-text-DEFAULT',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'new' ? (
        <WorkoutForm
          today={today}
          onSuccess={(res) => {
            const total = res.xp_deltas.reduce((s, d) => s + d.amount, 0);
            showXpToast(res.xp_deltas, total);
            setXpFloater({ total, key: Date.now() });
          }}
        />
      ) : tab === 'history' ? (
        <HistoryTab today={today} />
      ) : tab === 'perf' ? (
        <PerfTestsTab today={today} />
      ) : (
        <ProgrammeTab />
      )}

      {/* XP floater */}
      <AnimatePresence>
        {xpFloater && (
          <motion.div
            key={xpFloater.key}
            initial={{ opacity: 1, y: 0 }}
            animate={{ opacity: 0, y: -80 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.4 }}
            onAnimationComplete={() => setXpFloater(null)}
            className="fixed bottom-24 right-8 pointer-events-none z-50"
          >
            <span className="text-2xl font-bold text-accent-xp drop-shadow-lg">
              +{xpFloater.total} XP
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Workout Form ─────────────────────────────────────────────────────────────

function WorkoutForm({
  today,
  onSuccess,
}: {
  today: string;
  onSuccess: (res: PostWorkoutResponse) => void;
}) {
  const [successBanner, setSuccessBanner] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { isSubmitting },
  } = useForm<WorkoutFormValues>({
    resolver: zodResolver(WorkoutFormSchema),
    defaultValues: {
      date: today,
      type: 'push',
      exercises: [],
    },
  });

  const { fields: exFields, append: exAppend, remove: exRemove } = useFieldArray({
    control,
    name: 'exercises',
  });

  const onSubmit = async (values: WorkoutFormValues) => {
    try {
      const body: Record<string, unknown> = {
        date: values.date,
        type: values.type,
        exercises: values.exercises,
      };
      if (values.duration_min) body.duration_min = values.duration_min;
      if (values.rpe) body.rpe = values.rpe;
      if (values.notes) body.notes = values.notes;

      const res = await apiFetch<PostWorkoutResponse>('/workouts', {
        method: 'POST',
        body: JSON.stringify(body),
      });
      onSuccess(res);
      reset({ date: today, type: 'push', exercises: [] });
      setSuccessBanner(true);
      setTimeout(() => setSuccessBanner(false), 4000);
    } catch {
      toast.error("Erreur lors de l'enregistrement de la séance.");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {successBanner && (
        <div className="rounded-lg border border-accent-endurance/40 bg-accent-endurance/5 p-3 text-sm text-accent-endurance text-center font-medium">
          Séance enregistrée !
        </div>
      )}

      {/* Infos générales */}
      <section>
        <SectionHeading>Infos générales</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Date</label>
            <input type="date" {...register('date')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Type</label>
            <select {...register('type')} className={inputCls}>
              {(['push', 'pull', 'legs', 'upper', 'lower', 'full', 'cardio', 'mobility', 'other'] as const).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Durée (min)</label>
            <input type="number" min={0} max={600} placeholder="60" {...register('duration_min')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>RPE global (1-10)</label>
            <input type="number" min={1} max={10} step={0.5} placeholder="7" {...register('rpe')} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Exercices */}
      <section>
        <SectionHeading>Exercices</SectionHeading>
        {exFields.length === 0 && (
          <p className="text-text-muted text-sm mb-3">Aucun exercice ajouté.</p>
        )}
        <div className="space-y-4">
          {exFields.map((ex, exIdx) => (
            <ExerciseBlock
              key={ex.id}
              exIdx={exIdx}
              register={register}
              control={control}
              onRemove={() => exRemove(exIdx)}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={() => exAppend({ name: '', sets: [{ reps: 0 }] })}
          className="mt-3 flex items-center gap-1 text-xs text-accent-endurance hover:text-accent-endurance/80"
        >
          <Plus size={12} /> Ajouter un exercice
        </button>
      </section>

      {/* Notes */}
      <section>
        <SectionHeading>Notes</SectionHeading>
        <textarea rows={3} placeholder="Observations, ressenti…" {...register('notes')} className={inputCls} />
      </section>

      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-accent-endurance text-bg-DEFAULT font-bold py-3 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 size={16} className="animate-spin" />}
        Enregistrer la séance
      </button>
    </form>
  );
}

// ─── Exercise Block ───────────────────────────────────────────────────────────

function ExerciseBlock({
  exIdx,
  register,
  control,
  onRemove,
}: {
  exIdx: number;
  register: ReturnType<typeof useForm<WorkoutFormValues>>['register'];
  control: ReturnType<typeof useForm<WorkoutFormValues>>['control'];
  onRemove: () => void;
}) {
  const { fields: setFields, append: setAppend, remove: setRemove } = useFieldArray({
    control,
    name: `exercises.${exIdx}.sets`,
  });

  return (
    <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4 space-y-3">
      <div className="flex items-center gap-2">
        <input
          placeholder="Nom de l'exercice (Squat…)"
          {...register(`exercises.${exIdx}.name`)}
          className="flex-1 rounded bg-bg-strong border border-bg-strong focus:border-accent-endurance/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted"
        />
        <button type="button" onClick={onRemove} className="text-text-muted hover:text-accent-force">
          <X size={16} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-2 text-xs text-text-muted px-1">
          <span>Reps</span>
          <span>Poids (kg)</span>
          <span>RPE</span>
        </div>
        {setFields.map((set, setIdx) => (
          <div key={set.id} className="flex items-center gap-2">
            <div className="grid grid-cols-3 gap-2 flex-1">
              <input type="number" min={0} max={500} placeholder="10" {...register(`exercises.${exIdx}.sets.${setIdx}.reps`)} className="rounded bg-bg-strong border border-bg-strong focus:border-accent-endurance/50 outline-none px-2 py-1.5 text-sm text-text-DEFAULT placeholder:text-text-muted w-full" />
              <input type="number" min={0} step={0.5} placeholder="60" {...register(`exercises.${exIdx}.sets.${setIdx}.weight_kg`)} className="rounded bg-bg-strong border border-bg-strong focus:border-accent-endurance/50 outline-none px-2 py-1.5 text-sm text-text-DEFAULT placeholder:text-text-muted w-full" />
              <input type="number" min={1} max={10} step={0.5} placeholder="8" {...register(`exercises.${exIdx}.sets.${setIdx}.rpe`)} className="rounded bg-bg-strong border border-bg-strong focus:border-accent-endurance/50 outline-none px-2 py-1.5 text-sm text-text-DEFAULT placeholder:text-text-muted w-full" />
            </div>
            <button type="button" onClick={() => setRemove(setIdx)} className="text-text-muted hover:text-accent-force flex-shrink-0">
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setAppend({ reps: 0 })}
          className="flex items-center gap-1 text-xs text-accent-endurance/70 hover:text-accent-endurance"
        >
          <Plus size={10} /> Ajouter une série
        </button>
      </div>
    </div>
  );
}

// ─── History Tab ──────────────────────────────────────────────────────────────

function HistoryTab({ today }: { today: string }) {
  const [workouts, setWorkouts] = useState<Workout[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    const from = shiftDate(today, -30);
    apiFetch<{ items: Workout[] }>(`/workouts?from=${from}&to=${today}`)
      .then((res) => setWorkouts([...res.items].sort((a, b) => (a.date < b.date ? 1 : -1))))
      .catch(() => setWorkouts([]))
      .finally(() => setLoading(false));
  }, [today]);

  if (loading) return <div className="text-text-muted text-sm">…</div>;
  if (workouts.length === 0) {
    return (
      <div className="rounded-lg border border-bg-strong bg-bg-subtle p-8 text-center">
        <div className="text-3xl mb-3">🏋️</div>
        <p className="text-text-muted text-sm">Aucune séance enregistrée.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {workouts.map((w) => {
        const totalSets = w.exercises.reduce((s, ex) => s + ex.sets.length, 0);
        const isExpanded = expandedId === w.id;
        return (
          <div key={w.id} className="rounded-lg border border-bg-strong bg-bg-subtle overflow-hidden">
            <button
              type="button"
              onClick={() => setExpandedId(isExpanded ? null : w.id)}
              className="w-full flex items-center justify-between p-4 text-left hover:bg-bg-strong/30 transition-colors"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-text-muted">{formatHumanDate(w.date)}</span>
                  <span className="text-xs font-bold text-accent-endurance uppercase tracking-wider">{w.type}</span>
                </div>
                <div className="flex items-center gap-4 text-xs text-text-muted">
                  <span>{w.exercises.length} exercice{w.exercises.length !== 1 ? 's' : ''}</span>
                  <span>{totalSets} série{totalSets !== 1 ? 's' : ''}</span>
                  {w.duration_min && <span>{w.duration_min} min</span>}
                  {w.rpe && <span>RPE {w.rpe}</span>}
                </div>
              </div>
              {isExpanded ? <ChevronUp size={16} className="text-text-muted" /> : <ChevronDown size={16} className="text-text-muted" />}
            </button>
            {isExpanded && (
              <div className="border-t border-bg-strong p-4 space-y-3">
                {w.exercises.map((ex, i) => (
                  <div key={i}>
                    <div className="text-sm font-medium mb-1">{ex.name}</div>
                    <div className="grid grid-cols-3 gap-1 text-xs text-text-muted mb-1 px-1">
                      <span>Reps</span><span>Poids</span><span>RPE</span>
                    </div>
                    {ex.sets.map((s, j) => (
                      <div key={j} className="grid grid-cols-3 gap-1 text-xs px-1 py-0.5">
                        <span>{s.reps}</span>
                        <span>{s.weight_kg ?? '—'}{s.weight_kg ? ' kg' : ''}</span>
                        <span>{s.rpe ?? '—'}</span>
                      </div>
                    ))}
                  </div>
                ))}
                {w.notes && <p className="text-xs text-text-muted italic mt-2">{w.notes}</p>}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ─── Perf Tests Tab ───────────────────────────────────────────────────────────

const PERF_TYPES: PerfTestType[] = [
  '1rm_bench', '1rm_squat', '1rm_deadlift', '1rm_ohp',
  'pullups_max', 'pushups_max', 'plank_max', 'vo2max', 'mile_time', '5k_time',
];

const PERF_LABELS: Record<PerfTestType, string> = {
  '1rm_bench': 'Bench 1RM',
  '1rm_squat': 'Squat 1RM',
  '1rm_deadlift': 'Deadlift 1RM',
  '1rm_ohp': 'OHP 1RM',
  'pullups_max': 'Tractions max',
  'pushups_max': 'Pompes max',
  'plank_max': 'Gainage max',
  'vo2max': 'VO2max',
  'mile_time': 'Mile (temps)',
  '5k_time': '5K (temps)',
};

const PERF_UNITS: Record<PerfTestType, string> = {
  '1rm_bench': 'kg', '1rm_squat': 'kg', '1rm_deadlift': 'kg', '1rm_ohp': 'kg',
  'pullups_max': 'reps', 'pushups_max': 'reps', 'plank_max': 'sec',
  'vo2max': 'ml/kg/min', 'mile_time': 'sec', '5k_time': 'sec',
};

function PerfTestsTab({ today }: { today: string }) {
  const [tests, setTests] = useState<PerfTest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [type, setType] = useState<PerfTestType>('1rm_bench');
  const [value, setValue] = useState('');
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState('');

  const load = () => {
    setLoading(true);
    apiFetch<{ items: PerfTest[] }>('/perf-tests')
      .then((r) => setTests([...r.items].reverse()))
      .catch(() => setTests([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!value) return;
    setSubmitting(true);
    try {
      const res = await apiFetch<PerfTest & { xp_deltas: XpDelta[] }>('/perf-tests', {
        method: 'POST',
        body: JSON.stringify({
          type,
          value: parseFloat(value),
          unit: PERF_UNITS[type],
          date,
          ...(notes ? { notes } : {}),
        }),
      });
      if (res.xp_deltas && res.xp_deltas.length > 0) {
        const total = res.xp_deltas.reduce((s, d) => s + d.amount, 0);
        showXpToast(res.xp_deltas, total);
      } else {
        toast.success('Test enregistré !');
      }
      setValue('');
      setNotes('');
      load();
    } catch {
      toast.error("Erreur lors de l'enregistrement.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-lg border border-bg-strong bg-bg-subtle p-5 space-y-4">
        <h3 className="font-display tracking-widest text-xs text-accent-endurance uppercase">Nouveau test</h3>
        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Type</label>
              <select value={type} onChange={(e) => setType(e.target.value as PerfTestType)} className={inputCls}>
                {PERF_TYPES.map((t) => <option key={t} value={t}>{PERF_LABELS[t]}</option>)}
              </select>
            </div>
            <div>
              <label className={labelCls}>Date</label>
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Valeur ({PERF_UNITS[type]})</label>
              <input type="number" step="0.1" min="0" value={value} onChange={(e) => setValue(e.target.value)} placeholder={`ex: ${type.includes('1rm') ? '100' : '10'}`} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Notes</label>
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Conditions, ressenti…" className={inputCls} />
            </div>
          </div>
          <button type="submit" disabled={submitting || !value} className="w-full rounded-lg bg-accent-endurance text-bg-DEFAULT font-bold py-2.5 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            Enregistrer
          </button>
        </form>
      </section>

      <section className="space-y-2">
        <h3 className="font-display tracking-widest text-xs text-accent-endurance uppercase">Historique</h3>
        {loading ? (
          <div className="text-text-muted text-sm">…</div>
        ) : tests.length === 0 ? (
          <div className="rounded-lg border border-bg-strong bg-bg-subtle p-6 text-center">
            <p className="text-text-muted text-sm">Aucun test enregistré.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-bg-strong overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-bg-strong bg-bg-subtle">
                  <th className="text-left text-xs text-text-muted font-medium px-3 py-2">Type</th>
                  <th className="text-right text-xs text-text-muted font-medium px-3 py-2">Valeur</th>
                  <th className="text-right text-xs text-text-muted font-medium px-3 py-2">Date</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((t, i) => (
                  <tr key={t.id} className={i % 2 === 0 ? 'bg-bg-DEFAULT' : 'bg-bg-subtle'}>
                    <td className="px-3 py-2 text-text-DEFAULT">{PERF_LABELS[t.type as PerfTestType] ?? t.type}</td>
                    <td className="px-3 py-2 text-right font-mono text-accent-endurance">
                      {t.value} <span className="text-text-muted text-xs">{t.unit}</span>
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-xs text-text-muted">{t.date}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

// ─── Programme Tab ────────────────────────────────────────────────────────────
// TODO: persist to backend profile.routine_text endpoint when available.

const PROGRAMME_LS_KEY = 'lifeos:sport:programme';

function ProgrammeTab() {
  const [text, setText] = useState('');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(PROGRAMME_LS_KEY);
    if (stored) setText(stored);
  }, []);

  const handleSave = () => {
    localStorage.setItem(PROGRAMME_LS_KEY, text);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    toast.success('Programme sauvegardé');
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4 space-y-3">
        <h3 className="font-display tracking-widest text-xs text-accent-endurance uppercase border-b border-bg-strong pb-1 mb-3">
          Mon programme actuel
        </h3>
        <p className="text-xs text-text-muted">
          Note ta routine ici — split, exercices, fréquence. Sauvegardé localement.
        </p>
        <textarea
          rows={12}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Ex: Lundi — Push (Bench 5x5, OHP 4x8…)"
          className="w-full rounded bg-bg-strong border border-bg-strong focus:border-accent-endurance/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted font-mono resize-y"
        />
        <button
          type="button"
          onClick={handleSave}
          className={cls(
            'rounded-lg px-5 py-2 text-sm font-bold tracking-wider transition-opacity',
            saved
              ? 'bg-accent-endurance/30 text-accent-endurance'
              : 'bg-accent-endurance text-bg-DEFAULT hover:opacity-90',
          )}
        >
          {saved ? 'Sauvegardé ✓' : 'Sauvegarder'}
        </button>
      </div>
    </div>
  );
}
