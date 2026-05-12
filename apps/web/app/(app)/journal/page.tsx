'use client';
import { useEffect, useState } from 'react';
import { useForm, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, X, Loader2 } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';
import { todayStr, shiftDate, formatHumanDate } from '@/lib/dates';
import { showXpToast, type XpDelta } from '@/components/xp-toast';
import { LogHistoryCard } from '@/components/log-history-card';
import { VoiceRecorder } from '@/components/voice-recorder';
import type { DailyLog } from '@lifeos/shared';

// ─── Form schema ────────────────────────────────────────────────────────────

const FormSchema = z.object({
  sleep_h: z.coerce.number().int().min(0).max(24).optional(),
  sleep_min: z.coerce.number().int().min(0).max(59).optional(),
  sleep_quality: z.coerce.number().int().min(1).max(10).optional(),
  sleep_bedtime: z.string().optional(),
  sleep_wake: z.string().optional(),
  mood: z.coerce.number().int().min(1).max(10),
  energy: z.coerce.number().int().min(1).max(10),
  focus: z.coerce.number().int().min(1).max(10),
  mood_notes: z.string().max(2000).optional(),
  hydration_l: z.coerce.number().min(0).max(20).optional(),
  skincare_am: z.boolean(),
  skincare_pm: z.boolean(),
  skincare_notes: z.string().max(500).optional(),
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

// ─── API Response type ───────────────────────────────────────────────────────

interface PutLogResponse {
  date: string;
  xp_deltas: XpDelta[];
  stats: { global_level: number; global_xp: number };
}

// ─── Field helpers ───────────────────────────────────────────────────────────

function cls(...classes: (string | false | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}

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

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function JournalPage() {
  const [tab, setTab] = useState<'today' | 'history'>('today');
  const [xpFloater, setXpFloater] = useState<{ total: number; key: number } | null>(null);
  const [successBanner, setSuccessBanner] = useState<{
    level: number;
    xp: number;
  } | null>(null);
  const today = todayStr();

  return (
    <div className="max-w-2xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Journal</h1>
        <span className="text-xs text-text-muted font-mono">{formatHumanDate(today)}</span>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-bg-strong">
        {(['today', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cls(
              'px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px',
              tab === t
                ? 'border-accent-spirit text-accent-spirit'
                : 'border-transparent text-text-muted hover:text-text-DEFAULT',
            )}
          >
            {t === 'today' ? "Aujourd'hui" : 'Historique'}
          </button>
        ))}
      </div>

      {tab === 'today' ? (
        <TodayTab
          today={today}
          onSuccess={(res) => {
            const total = res.xp_deltas.reduce((s, d) => s + d.amount, 0);
            showXpToast(res.xp_deltas, total);
            setXpFloater({ total, key: Date.now() });
            if (res.stats) setSuccessBanner({ level: res.stats.global_level, xp: res.stats.global_xp });
          }}
        />
      ) : (
        <HistoryTab today={today} />
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

      {/* Success banner */}
      <AnimatePresence>
        {successBanner && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="fixed top-6 left-1/2 -translate-x-1/2 z-50 bg-bg-subtle border border-accent-xp/40 rounded-lg px-5 py-3 shadow-lg"
          >
            <div className="flex items-center gap-3">
              <span className="text-accent-xp font-bold font-display tracking-wider">
                NIVEAU {successBanner.level}
              </span>
              <span className="text-text-muted text-sm">{successBanner.xp} XP global</span>
              <button
                onClick={() => setSuccessBanner(null)}
                className="text-text-muted hover:text-text-DEFAULT ml-2"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Today Tab (VoiceRecorder + DailyLogForm) ────────────────────────────────

function TodayTab({
  today,
  onSuccess,
}: {
  today: string;
  onSuccess: (res: PutLogResponse) => void;
}) {
  const [voiceDraftKey, setVoiceDraftKey] = useState(0);

  // Use a key-based approach: when voice applies a draft, we re-mount the form with new defaults.
  // We pass the draft as initialValues to DailyLogForm.
  const [initialValues, setInitialValues] = useState<Partial<FormValues> | null>(null);

  const handleApplyDraft = (
    draft: {
      sleep?: { duration_min: number; quality?: number; bedtime?: string; wake_time?: string };
      mood?: { mood: number; energy: number; focus: number; notes?: string };
      hydration_l?: number;
      skincare?: { am?: boolean; pm?: boolean; notes?: string };
      supplements?: { name: string; dose?: string }[];
      meals?: { slot: string; description: string; score?: number }[];
      notes?: string;
    },
  ) => {
    const vals: Partial<FormValues> = {};
    if (draft.sleep) {
      vals.sleep_h = Math.floor(draft.sleep.duration_min / 60);
      vals.sleep_min = draft.sleep.duration_min % 60;
      if (draft.sleep.quality) vals.sleep_quality = draft.sleep.quality;
      if (draft.sleep.bedtime) vals.sleep_bedtime = draft.sleep.bedtime;
      if (draft.sleep.wake_time) vals.sleep_wake = draft.sleep.wake_time;
    }
    if (draft.mood) {
      vals.mood = draft.mood.mood;
      vals.energy = draft.mood.energy;
      vals.focus = draft.mood.focus;
      if (draft.mood.notes) vals.mood_notes = draft.mood.notes;
    }
    if (draft.hydration_l != null) vals.hydration_l = draft.hydration_l;
    if (draft.skincare) {
      vals.skincare_am = draft.skincare.am ?? false;
      vals.skincare_pm = draft.skincare.pm ?? false;
      if (draft.skincare.notes) vals.skincare_notes = draft.skincare.notes;
    }
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

  return (
    <div className="space-y-6">
      <VoiceRecorder date={today} onApplyDraft={handleApplyDraft} />
      <DailyLogForm
        key={voiceDraftKey}
        today={today}
        voiceInitialValues={initialValues}
        onSuccess={onSuccess}
      />
    </div>
  );
}

// ─── DailyLog Form ───────────────────────────────────────────────────────────

function DailyLogForm({
  today,
  voiceInitialValues,
  onSuccess,
}: {
  today: string;
  voiceInitialValues?: Partial<FormValues> | null;
  onSuccess: (res: PutLogResponse) => void;
}) {
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
      skincare_am: false,
      skincare_pm: false,
      supplements: [],
      meals: [],
    },
  });

  const { fields: supFields, append: supAppend, remove: supRemove } = useFieldArray({
    control,
    name: 'supplements',
  });
  const { fields: mealFields, append: mealAppend, remove: mealRemove } = useFieldArray({
    control,
    name: 'meals',
  });

  // Pre-fill from existing log (or from voice draft when provided)
  useEffect(() => {
    if (voiceInitialValues) {
      // Voice draft takes priority — reset with the voice-parsed values
      reset({
        mood: 5,
        energy: 5,
        focus: 5,
        skincare_am: false,
        skincare_pm: false,
        supplements: [],
        meals: [],
        ...voiceInitialValues,
      });
      return;
    }
    apiFetch<DailyLog & Record<string, unknown>>(`/daily-log/${today}`)
      .then((log) => {
        const vals: Partial<FormValues> = {};
        if (log.sleep) {
          vals.sleep_h = Math.floor(log.sleep.duration_min / 60);
          vals.sleep_min = log.sleep.duration_min % 60;
          vals.sleep_quality = log.sleep.quality;
          vals.sleep_bedtime = log.sleep.bedtime ?? '';
          vals.sleep_wake = log.sleep.wake_time ?? '';
        }
        if (log.mood) {
          vals.mood = log.mood.mood;
          vals.energy = log.mood.energy;
          vals.focus = log.mood.focus;
          vals.mood_notes = log.mood.notes ?? '';
        }
        if (log.hydration_l != null) vals.hydration_l = log.hydration_l;
        if (log.skincare) {
          vals.skincare_am = log.skincare.am;
          vals.skincare_pm = log.skincare.pm;
          vals.skincare_notes = log.skincare.notes ?? '';
        }
        if (log.supplements) {
          vals.supplements = log.supplements.map((s) => ({ name: s.name, dose: s.dose ?? '' }));
        }
        if (log.meals) {
          vals.meals = log.meals.map((m) => ({
            slot: m.slot,
            description: m.description,
            score: m.score,
          }));
        }
        if (log.notes) vals.notes = log.notes;
        reset({ ...vals, mood: vals.mood ?? 5, energy: vals.energy ?? 5, focus: vals.focus ?? 5, skincare_am: vals.skincare_am ?? false, skincare_pm: vals.skincare_pm ?? false, supplements: vals.supplements ?? [], meals: vals.meals ?? [] });
      })
      .catch(() => {
        // 404 is fine — no existing log
      });
  }, [today, reset, voiceInitialValues]);

  const moodVal = watch('mood');
  const energyVal = watch('energy');
  const focusVal = watch('focus');

  const onSubmit = async (values: FormValues) => {
    const body: Record<string, unknown> = {};

    // Sleep
    const sleepH = values.sleep_h ?? 0;
    const sleepMin = values.sleep_min ?? 0;
    if (sleepH > 0 || sleepMin > 0 || values.sleep_quality || values.sleep_bedtime || values.sleep_wake) {
      body.sleep = {
        duration_min: sleepH * 60 + sleepMin,
        ...(values.sleep_quality ? { quality: values.sleep_quality } : {}),
        ...(values.sleep_bedtime ? { bedtime: values.sleep_bedtime } : {}),
        ...(values.sleep_wake ? { wake_time: values.sleep_wake } : {}),
      };
    }

    // Mood
    body.mood = {
      mood: values.mood,
      energy: values.energy,
      focus: values.focus,
      ...(values.mood_notes ? { notes: values.mood_notes } : {}),
    };

    // Hydration
    if (values.hydration_l != null) body.hydration_l = values.hydration_l;

    // Skincare
    if (values.skincare_am || values.skincare_pm || values.skincare_notes) {
      body.skincare = {
        am: values.skincare_am,
        pm: values.skincare_pm,
        ...(values.skincare_notes ? { notes: values.skincare_notes } : {}),
      };
    }

    // Supplements
    const sups = values.supplements.filter((s) => s.name.trim());
    if (sups.length > 0) {
      body.supplements = sups.map((s) => ({ name: s.name, ...(s.dose ? { dose: s.dose } : {}) }));
    }

    // Meals
    const meals = values.meals.filter((m) => m.description.trim());
    if (meals.length > 0) {
      body.meals = meals.map((m) => ({
        slot: m.slot,
        description: m.description,
        ...(m.score ? { score: m.score } : {}),
      }));
    }

    // Notes
    if (values.notes) body.notes = values.notes;

    const res = await apiFetch<PutLogResponse>(`/daily-log/${today}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    });
    onSuccess(res);
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* Sommeil */}
      <section>
        <SectionHeading>Sommeil</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelCls}>Durée (heures)</label>
            <input type="number" min={0} max={24} placeholder="7" {...register('sleep_h')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Minutes</label>
            <input type="number" min={0} max={59} placeholder="30" {...register('sleep_min')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Qualité (1-10)</label>
            <input type="number" min={1} max={10} placeholder="7" {...register('sleep_quality')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Coucher</label>
            <input type="time" {...register('sleep_bedtime')} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Réveil</label>
            <input type="time" {...register('sleep_wake')} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Humeur */}
      <section>
        <SectionHeading>Humeur &amp; Énergie</SectionHeading>
        <div className="space-y-4">
          <SliderField
            label="Humeur"
            value={moodVal}
            onChange={(v) => setValue('mood', v)}
            color="accent-spirit"
          />
          <SliderField
            label="Énergie"
            value={energyVal}
            onChange={(v) => setValue('energy', v)}
            color="accent-endurance"
          />
          <SliderField
            label="Focus"
            value={focusVal}
            onChange={(v) => setValue('focus', v)}
            color="accent-discipline"
          />
          <div>
            <label className={labelCls}>Notes humeur</label>
            <textarea
              rows={2}
              placeholder="Comment tu te sens ?"
              {...register('mood_notes')}
              className={inputCls}
            />
          </div>
        </div>
      </section>

      {/* Hydratation */}
      <section>
        <SectionHeading>Hydratation</SectionHeading>
        <div className="max-w-[160px]">
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
      </section>

      {/* Skincare */}
      <section>
        <SectionHeading>Skincare</SectionHeading>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('skincare_am')}
              className="w-4 h-4 accent-accent-appearance"
            />
            <span className="text-sm">Routine AM faite</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              {...register('skincare_pm')}
              className="w-4 h-4 accent-accent-appearance"
            />
            <span className="text-sm">Routine PM faite</span>
          </label>
          <div>
            <label className={labelCls}>Notes skincare</label>
            <textarea rows={2} placeholder="Observations…" {...register('skincare_notes')} className={inputCls} />
          </div>
        </div>
      </section>

      {/* Suppléments */}
      <section>
        <SectionHeading>Suppléments</SectionHeading>
        <div className="space-y-2">
          {supFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-center">
              <input
                placeholder="Nom (créatine…)"
                {...register(`supplements.${i}.name`)}
                className={cls(inputCls, 'flex-1')}
              />
              <input
                placeholder="Dose (5g)"
                {...register(`supplements.${i}.dose`)}
                className={cls(inputCls, 'w-24')}
              />
              <button
                type="button"
                onClick={() => supRemove(i)}
                className="text-text-muted hover:text-accent-force"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => supAppend({ name: '', dose: '' })}
            className="flex items-center gap-1 text-xs text-accent-spirit hover:text-accent-spirit/80"
          >
            <Plus size={12} /> Ajouter supplément
          </button>
        </div>
      </section>

      {/* Repas */}
      <section>
        <SectionHeading>Repas</SectionHeading>
        <div className="space-y-2">
          {mealFields.map((field, i) => (
            <div key={field.id} className="flex gap-2 items-center flex-wrap">
              <select
                {...register(`meals.${i}.slot`)}
                className={cls(inputCls, 'w-32')}
              >
                <option value="breakfast">Matin</option>
                <option value="lunch">Midi</option>
                <option value="snack">Snack</option>
                <option value="dinner">Soir</option>
              </select>
              <input
                placeholder="Description…"
                {...register(`meals.${i}.description`)}
                className={cls(inputCls, 'flex-1')}
              />
              <input
                type="number"
                min={1}
                max={5}
                placeholder="Score 1-5"
                {...register(`meals.${i}.score`)}
                className={cls(inputCls, 'w-24')}
              />
              <button
                type="button"
                onClick={() => mealRemove(i)}
                className="text-text-muted hover:text-accent-force"
              >
                <X size={14} />
              </button>
            </div>
          ))}
          <button
            type="button"
            onClick={() => mealAppend({ slot: 'breakfast', description: '', score: undefined })}
            className="flex items-center gap-1 text-xs text-accent-spirit hover:text-accent-spirit/80"
          >
            <Plus size={12} /> Ajouter repas
          </button>
        </div>
      </section>

      {/* Notes */}
      <section>
        <SectionHeading>Notes</SectionHeading>
        <textarea
          rows={4}
          placeholder="Réflexions du jour, observations…"
          {...register('notes')}
          className={inputCls}
        />
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
  );
}

// ─── History Tab ─────────────────────────────────────────────────────────────

function HistoryTab({ today }: { today: string }) {
  const [logs, setLogs] = useState<(DailyLog & { date: string })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const from = shiftDate(today, -13);
    apiFetch<{ items: (DailyLog & { date: string })[] }>(`/daily-log?from=${from}&to=${today}`)
      .then((res) => setLogs([...res.items].sort((a, b) => (a.date < b.date ? 1 : -1))))
      .catch(() => setLogs([]))
      .finally(() => setLoading(false));
  }, [today]);

  if (loading) return <div className="text-text-muted text-sm">…</div>;
  if (logs.length === 0)
    return <div className="text-text-muted text-sm">Aucune entrée sur les 14 derniers jours.</div>;

  return (
    <div className="space-y-3">
      {logs.map((log) => (
        <LogHistoryCard key={log.date} log={log} />
      ))}
    </div>
  );
}
