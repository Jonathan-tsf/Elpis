'use client';
import { useEffect, useState, useCallback } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Plus, X, Loader2, Check } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { todayStr, formatHumanDate } from '@/lib/dates';
import { showXpToast, type XpDelta } from '@/components/xp-toast';
import { VoiceRecorder } from '@/components/voice-recorder';
import type { DailyLog, CustomHabit } from '@lifeos/shared';

// ─── Form schema ──────────────────────────────────────────────────────────────

const FormSchema = z.object({
  hydration_l: z.coerce.number().min(0).max(20).optional(),
  mood: z.coerce.number().int().min(1).max(10),
  energy: z.coerce.number().int().min(1).max(10),
  focus: z.coerce.number().int().min(1).max(10),
  supplements: z.array(z.object({ name: z.string(), dose: z.string() })),
  meals: z.array(
    z.object({
      slot: z.enum(['breakfast', 'lunch', 'snack', 'dinner']),
      description: z.string(),
      score: z.coerce.number().int().min(1).max(5).optional(),
    }),
  ),
  notes: z.string().max(5000).optional(),
});

type FormValues = z.infer<typeof FormSchema>;

interface PutLogResponse {
  date: string;
  xp_deltas: XpDelta[];
  stats: { global_level: number; global_xp: number };
}

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded bg-bg-strong border border-bg-strong focus:border-accent-spirit/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted';

const labelCls = 'text-xs text-text-muted uppercase tracking-wide';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display tracking-widest text-xs text-accent-spirit uppercase border-b border-bg-strong pb-1 mb-3">
      {children}
    </h3>
  );
}

function SliderField({
  label,
  value,
  onChange,
  color = 'accent-spirit',
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color?: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center">
        <label className={labelCls}>{label}</label>
        <span className={`text-sm font-bold text-${color}`}>{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={10}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-full accent-current"
      />
    </div>
  );
}

// ─── Custom Habit Row ─────────────────────────────────────────────────────────

interface TodayHabitItem {
  habit: Pick<CustomHabit, 'id' | 'name' | 'icon' | 'frequency' | 'measurement' | 'target_per_period'>;
  log: { habit_id: string; date: string; value?: number; done?: boolean; notes?: string } | null;
}

function HabitRow({
  item,
  onToggle,
}: {
  item: TodayHabitItem;
  onToggle: (habitId: string, current: boolean) => Promise<void>;
}) {
  const [toggling, setToggling] = useState(false);
  const isDone = item.habit.measurement === 'boolean' ? (item.log?.done ?? false) : (item.log != null);

  const handleClick = async () => {
    setToggling(true);
    try {
      await onToggle(item.habit.id, isDone);
    } finally {
      setToggling(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-3 rounded-lg border border-bg-strong bg-bg-subtle">
      <div className="flex items-center gap-3">
        <span className="text-xl">{item.habit.icon ?? '✦'}</span>
        <div>
          <div className="text-sm font-medium">{item.habit.name}</div>
          <div className="text-xs text-text-muted capitalize">{item.habit.frequency}</div>
        </div>
      </div>
      <button
        type="button"
        onClick={handleClick}
        disabled={toggling}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors border-2 ${
          isDone
            ? 'border-accent-discipline bg-accent-discipline/20 text-accent-discipline'
            : 'border-bg-strong bg-bg-DEFAULT text-text-muted hover:border-accent-discipline/50'
        }`}
      >
        {toggling ? <Loader2 size={12} className="animate-spin" /> : isDone ? <Check size={14} /> : <span className="text-xs">○</span>}
      </button>
    </div>
  );
}

// ─── Add Habit Form ───────────────────────────────────────────────────────────

const NewHabitSchema = z.object({
  name: z.string().min(1).max(80),
  icon: z.string().max(8).optional(),
  frequency: z.enum(['daily', 'weekly', 'custom']),
  measurement: z.enum(['boolean', 'count', 'duration_min']),
});
type NewHabitValues = z.infer<typeof NewHabitSchema>;

function AddHabitForm({ onCreated }: { onCreated: (habit: CustomHabit) => void }) {
  const [open, setOpen] = useState(false);
  const { register, handleSubmit, reset, formState: { isSubmitting } } = useForm<NewHabitValues>({
    resolver: zodResolver(NewHabitSchema),
    defaultValues: { frequency: 'daily', measurement: 'boolean' },
  });

  const onSubmit = async (values: NewHabitValues) => {
    try {
      const habit = await apiFetch<CustomHabit>('/habits', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      onCreated(habit);
      reset({ frequency: 'daily', measurement: 'boolean' });
      setOpen(false);
      toast.success('Habitude créée !');
    } catch {
      toast.error("Erreur lors de la création");
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex items-center gap-1 text-xs text-accent-spirit hover:text-accent-spirit/80"
      >
        <Plus size={12} /> Ajouter une habitude
      </button>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="rounded-lg border border-accent-spirit/30 bg-bg-subtle p-4 space-y-3">
      <div className="flex items-center justify-between mb-1">
        <span className="text-xs font-bold text-accent-spirit uppercase tracking-wider">Nouvelle habitude</span>
        <button type="button" onClick={() => setOpen(false)} className="text-text-muted hover:text-text-DEFAULT">
          <X size={14} />
        </button>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className={labelCls}>Nom</label>
          <input type="text" placeholder="Méditation, Sport…" {...register('name')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Icône (emoji)</label>
          <input type="text" placeholder="🧘" maxLength={8} {...register('icon')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Fréquence</label>
          <select {...register('frequency')} className={inputCls}>
            <option value="daily">Quotidienne</option>
            <option value="weekly">Hebdomadaire</option>
            <option value="custom">Custom</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className={labelCls}>Mesure</label>
          <select {...register('measurement')} className={inputCls}>
            <option value="boolean">Oui / Non</option>
            <option value="count">Compteur</option>
            <option value="duration_min">Durée (min)</option>
          </select>
        </div>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-accent-spirit text-bg-DEFAULT font-bold py-2 text-sm tracking-wider hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
        Créer
      </button>
    </form>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function HabitudesPage() {
  const today = todayStr();
  const [loading, setLoading] = useState(true);
  const [todayHabits, setTodayHabits] = useState<TodayHabitItem[]>([]);
  const [voiceDraftKey, setVoiceDraftKey] = useState(0);
  const [initialValues, setInitialValues] = useState<Partial<FormValues> | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    control,
    formState: { isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(FormSchema),
    defaultValues: {
      mood: 5,
      energy: 5,
      focus: 5,
      supplements: [],
      meals: [],
    },
  });

  const { fields: supFields, append: supAppend, remove: supRemove } = useFieldArray({ control, name: 'supplements' });
  const { fields: mealFields, append: mealAppend, remove: mealRemove } = useFieldArray({ control, name: 'meals' });

  const moodVal = watch('mood');
  const energyVal = watch('energy');
  const focusVal = watch('focus');
  const hydrationVal = watch('hydration_l') ?? 0;

  const loadHabits = useCallback(async () => {
    try {
      const res = await apiFetch<{ date: string; items: TodayHabitItem[] }>('/habits/logs/today');
      setTodayHabits(res.items);
    } catch {
      // silently — user may have no habits yet
    }
  }, []);

  // Pre-fill form from existing daily log
  useEffect(() => {
    if (initialValues) {
      reset({
        mood: 5,
        energy: 5,
        focus: 5,
        supplements: [],
        meals: [],
        ...initialValues,
      });
      return;
    }
    apiFetch<DailyLog & Record<string, unknown>>(`/daily-log/${today}`)
      .then((log) => {
        const vals: Partial<FormValues> = {};
        if (log.mood) {
          vals.mood = log.mood.mood;
          vals.energy = log.mood.energy;
          vals.focus = log.mood.focus;
        }
        if (log.hydration_l != null) vals.hydration_l = log.hydration_l;
        if (log.supplements) {
          vals.supplements = log.supplements.map((s) => ({ name: s.name, dose: s.dose ?? '' }));
        }
        if (log.meals) {
          vals.meals = log.meals.map((m) => ({ slot: m.slot, description: m.description, score: m.score }));
        }
        if (log.notes) vals.notes = log.notes;
        reset({ mood: vals.mood ?? 5, energy: vals.energy ?? 5, focus: vals.focus ?? 5, supplements: vals.supplements ?? [], meals: vals.meals ?? [], hydration_l: vals.hydration_l, notes: vals.notes });
      })
      .catch(() => {/* 404 is fine */});
  }, [today, reset, initialValues]);

  useEffect(() => {
    Promise.all([loadHabits()]).finally(() => setLoading(false));
  }, [loadHabits]);

  const handleApplyDraft = (draft: {
    sleep?: { duration_min: number; quality?: number; bedtime?: string; wake_time?: string };
    mood?: { mood: number; energy: number; focus: number; notes?: string };
    hydration_l?: number;
    skincare?: { am?: boolean; pm?: boolean; notes?: string };
    supplements?: { name: string; dose?: string }[];
    meals?: { slot: string; description: string; score?: number }[];
    notes?: string;
  }) => {
    const vals: Partial<FormValues> = {};
    if (draft.mood) {
      vals.mood = draft.mood.mood;
      vals.energy = draft.mood.energy;
      vals.focus = draft.mood.focus;
    }
    if (draft.hydration_l != null) vals.hydration_l = draft.hydration_l;
    if (draft.supplements?.length) {
      vals.supplements = draft.supplements.map((s) => ({ name: s.name, dose: s.dose ?? '' }));
    }
    if (draft.meals?.length) {
      vals.meals = draft.meals.map((m) => ({
        slot: m.slot as 'breakfast' | 'lunch' | 'snack' | 'dinner',
        description: m.description,
        score: m.score,
      }));
    }
    if (draft.notes) vals.notes = draft.notes;
    setInitialValues(vals);
    setVoiceDraftKey((k) => k + 1);
  };

  const handleToggleHabit = async (habitId: string, currentlyDone: boolean) => {
    try {
      await apiFetch('/habits/logs', {
        method: 'POST',
        body: JSON.stringify({
          habit_id: habitId,
          date: today,
          done: !currentlyDone,
        }),
      });
      await loadHabits();
    } catch {
      toast.error("Erreur lors de l'enregistrement de l'habitude");
    }
  };

  const handleHabitCreated = (habit: CustomHabit) => {
    setTodayHabits((prev) => [...prev, { habit, log: null }]);
  };

  const handleArchiveHabit = async (habitId: string) => {
    try {
      await apiFetch(`/habits/${habitId}`, { method: 'DELETE' });
      setTodayHabits((prev) => prev.filter((h) => h.habit.id !== habitId));
      toast.success('Habitude archivée');
    } catch {
      toast.error("Erreur lors de l'archivage");
    }
  };

  const onSubmit = async (values: FormValues) => {
    const body: Record<string, unknown> = {};
    body.mood = { mood: values.mood, energy: values.energy, focus: values.focus };
    if (values.hydration_l != null) body.hydration_l = values.hydration_l;
    const sups = values.supplements.filter((s) => s.name.trim());
    if (sups.length > 0) body.supplements = sups.map((s) => ({ name: s.name, ...(s.dose ? { dose: s.dose } : {}) }));
    const meals = values.meals.filter((m) => m.description.trim());
    if (meals.length > 0) body.meals = meals.map((m) => ({ slot: m.slot, description: m.description, ...(m.score ? { score: m.score } : {}) }));
    if (values.notes) body.notes = values.notes;

    try {
      const res = await apiFetch<PutLogResponse>(`/daily-log/${today}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const total = res.xp_deltas.reduce((s, d) => s + d.amount, 0);
      showXpToast(res.xp_deltas, total);
      toast.success('Journée enregistrée');
    } catch (e) {
      toast.error(`Échec : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Habitudes</h1>
        <span className="text-xs text-text-muted font-mono">{formatHumanDate(today)}</span>
      </div>

      {/* Voice Recorder */}
      <VoiceRecorder date={today} onApplyDraft={handleApplyDraft} />

      <form key={voiceDraftKey} onSubmit={handleSubmit(onSubmit)} className="space-y-8">

        {/* Hydratation */}
        <section>
          <SectionHeading>Hydratation</SectionHeading>
          <div className="flex items-center gap-3">
            <div className="flex-1 max-w-[160px]">
              <label className={labelCls}>Litres bus</label>
              <input
                type="number"
                step="0.1"
                min={0}
                max={20}
                placeholder="2.5"
                {...register('hydration_l')}
                className={inputCls}
              />
            </div>
            <div className="flex gap-2 mt-4">
              {[0.25, 0.5, 1].map((ml) => (
                <button
                  key={ml}
                  type="button"
                  onClick={() => setValue('hydration_l', Math.min(20, (hydrationVal ?? 0) + ml))}
                  className="rounded bg-bg-strong border border-bg-strong px-2 py-1 text-xs text-text-muted hover:text-text-DEFAULT"
                >
                  +{ml}L
                </button>
              ))}
            </div>
          </div>
        </section>

        {/* Repas */}
        <section>
          <SectionHeading>Repas</SectionHeading>
          <div className="space-y-2">
            {mealFields.map((field, i) => (
              <div key={field.id} className="flex gap-2 items-center flex-wrap">
                <select {...register(`meals.${i}.slot`)} className="rounded bg-bg-strong border border-bg-strong outline-none px-3 py-2 text-sm text-text-DEFAULT w-32">
                  <option value="breakfast">Matin</option>
                  <option value="lunch">Midi</option>
                  <option value="snack">Snack</option>
                  <option value="dinner">Soir</option>
                </select>
                <input placeholder="Description…" {...register(`meals.${i}.description`)} className="rounded bg-bg-strong border border-bg-strong outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted flex-1" />
                <input type="number" min={1} max={5} placeholder="Score 1-5" {...register(`meals.${i}.score`)} className="rounded bg-bg-strong border border-bg-strong outline-none px-2 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted w-20" />
                <button type="button" onClick={() => mealRemove(i)} className="text-text-muted hover:text-accent-force"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => mealAppend({ slot: 'breakfast', description: '', score: undefined })} className="flex items-center gap-1 text-xs text-accent-spirit hover:text-accent-spirit/80">
              <Plus size={12} /> Ajouter repas
            </button>
          </div>
        </section>

        {/* Mood / Energy / Focus */}
        <section>
          <SectionHeading>Humeur &amp; Énergie</SectionHeading>
          <div className="space-y-4">
            <SliderField label="Humeur" value={moodVal} onChange={(v) => setValue('mood', v)} color="accent-spirit" />
            <SliderField label="Énergie" value={energyVal} onChange={(v) => setValue('energy', v)} color="accent-endurance" />
            <SliderField label="Focus" value={focusVal} onChange={(v) => setValue('focus', v)} color="accent-discipline" />
          </div>
        </section>

        {/* Suppléments */}
        <section>
          <SectionHeading>Suppléments</SectionHeading>
          <div className="space-y-2">
            {supFields.map((field, i) => (
              <div key={field.id} className="flex gap-2 items-center">
                <input placeholder="Nom (créatine…)" {...register(`supplements.${i}.name`)} className="rounded bg-bg-strong border border-bg-strong outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted flex-1" />
                <input placeholder="Dose (5g)" {...register(`supplements.${i}.dose`)} className="rounded bg-bg-strong border border-bg-strong outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted w-24" />
                <button type="button" onClick={() => supRemove(i)} className="text-text-muted hover:text-accent-force"><X size={14} /></button>
              </div>
            ))}
            <button type="button" onClick={() => supAppend({ name: '', dose: '' })} className="flex items-center gap-1 text-xs text-accent-spirit hover:text-accent-spirit/80">
              <Plus size={12} /> Ajouter supplément
            </button>
          </div>
        </section>

        {/* Habitudes custom */}
        <section>
          <SectionHeading>Mes habitudes</SectionHeading>
          {todayHabits.length === 0 ? (
            <p className="text-text-muted text-sm mb-3">Aucune habitude configurée.</p>
          ) : (
            <div className="space-y-2 mb-3">
              {todayHabits.map((item) => (
                <div key={item.habit.id} className="flex items-center gap-2">
                  <div className="flex-1">
                    <HabitRow item={item} onToggle={handleToggleHabit} />
                  </div>
                  <button
                    type="button"
                    onClick={() => handleArchiveHabit(item.habit.id)}
                    className="text-text-muted hover:text-accent-force shrink-0"
                    title="Archiver"
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <AddHabitForm onCreated={handleHabitCreated} />
        </section>

        {/* Notes */}
        <section>
          <SectionHeading>Notes</SectionHeading>
          <textarea rows={4} placeholder="Réflexions du jour…" {...register('notes')} className={inputCls} />
        </section>

        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-accent-spirit text-bg-DEFAULT font-bold py-3 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {isSubmitting && <Loader2 size={16} className="animate-spin" />}
          Enregistrer la journée
        </button>
      </form>
    </div>
  );
}
