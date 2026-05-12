'use client';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { apiFetch } from '@/lib/api-client';
import { todayStr, shiftDate } from '@/lib/dates';
import { StatsRadar } from '@/components/radar-chart';
import { StatBar } from '@/components/stat-bar';
import type { Stats, StatName } from '@lifeos/shared';

// ─── Measurement form schema ──────────────────────────────────────────────────

const METRICS = [
  'weight',
  'waist',
  'chest',
  'biceps_left',
  'biceps_right',
  'thigh_left',
  'thigh_right',
  'calf_left',
  'calf_right',
  'shoulders',
  'neck',
  'body_fat_pct',
] as const;

type MetricKey = (typeof METRICS)[number];

const METRIC_LABELS: Record<MetricKey, string> = {
  weight: 'Poids (kg)',
  waist: 'Tour de taille (cm)',
  chest: 'Tour de poitrine (cm)',
  biceps_left: 'Biceps gauche (cm)',
  biceps_right: 'Biceps droit (cm)',
  thigh_left: 'Cuisse gauche (cm)',
  thigh_right: 'Cuisse droite (cm)',
  calf_left: 'Mollet gauche (cm)',
  calf_right: 'Mollet droit (cm)',
  shoulders: 'Épaules (cm)',
  neck: 'Cou (cm)',
  body_fat_pct: 'Masse grasse (%)',
};

const MeasurementFormSchema = z.object({
  metric: z.enum(METRICS),
  value: z.coerce.number().min(0).max(1000),
  date: z.string().min(1),
  notes: z.string().max(500).optional(),
});

type MeasurementFormValues = z.infer<typeof MeasurementFormSchema>;

// ─── Shared styles ────────────────────────────────────────────────────────────

const inputCls =
  'w-full rounded bg-bg-strong border border-bg-strong focus:border-accent-vitality/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted';

const labelCls = 'text-xs text-text-muted uppercase tracking-wide';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display tracking-widest text-xs text-accent-vitality uppercase border-b border-bg-strong pb-1 mb-3">
      {children}
    </h3>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function StatsPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loadingStats, setLoadingStats] = useState(true);

  useEffect(() => {
    apiFetch<{ stats: Stats | null }>('/stats')
      .then((res) => setStats(res.stats))
      .catch(() => setStats(null))
      .finally(() => setLoadingStats(false));
  }, []);

  const statEntries = stats
    ? (Object.entries(stats.per_stat) as [StatName, { level: number; xp: number; xp_to_next: number }][])
    : [];

  return (
    <div className="max-w-2xl space-y-10">
      <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Stats</h1>

      {/* ── RPG Stats ── */}
      <section>
        <SectionHeading>Mes stats RPG</SectionHeading>

        {loadingStats ? (
          <div className="flex items-center justify-center h-40 text-text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : stats ? (
          <>
            {/* Level badge */}
            <div className="flex items-center gap-3 mb-4">
              <span className="font-display text-accent-xp text-lg tracking-wider">
                NIVEAU {stats.global_level}
              </span>
              <span className="text-text-muted text-sm">{stats.global_xp} XP global</span>
            </div>

            {/* Radar */}
            <div className="mb-6">
              <StatsRadar stats={stats} />
            </div>

            {/* Stat bars */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {statEntries.map(([stat, data]) => (
                <div key={stat} className="bg-bg-subtle rounded-lg border border-bg-strong p-3">
                  <StatBar
                    stat={stat}
                    level={data.level}
                    xp={data.xp}
                    xpToNext={data.xp_to_next}
                  />
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="rounded-lg border border-bg-strong bg-bg-subtle p-8 text-center">
            <div className="text-3xl mb-3">📊</div>
            <p className="text-text-muted text-sm">
              Aucune stat disponible. Commence par remplir ton journal ou une séance.
            </p>
          </div>
        )}
      </section>

      {/* ── Measurements ── */}
      <section className="space-y-6">
        <SectionHeading>Mensurations</SectionHeading>
        <MeasurementForm today={todayStr()} />
        <MeasurementChart />
      </section>
    </div>
  );
}

// ─── Measurement Form ─────────────────────────────────────────────────────────

function MeasurementForm({ today }: { today: string }) {
  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<MeasurementFormValues>({
    resolver: zodResolver(MeasurementFormSchema),
    defaultValues: { metric: 'weight', date: today },
  });

  const onSubmit = async (values: MeasurementFormValues) => {
    try {
      await apiFetch('/measurements', {
        method: 'POST',
        body: JSON.stringify(values),
      });
      toast.success('Mesure enregistrée !');
      reset({ metric: 'weight', date: today });
    } catch {
      toast.error('Erreur lors de l\'enregistrement de la mesure.');
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className={labelCls}>Métrique</label>
          <select {...register('metric')} className={inputCls}>
            {METRICS.map((m) => (
              <option key={m} value={m}>{METRIC_LABELS[m]}</option>
            ))}
          </select>
        </div>
        <div>
          <label className={labelCls}>Valeur</label>
          <input
            type="number"
            step="0.1"
            min={0}
            placeholder="75.5"
            {...register('value')}
            className={inputCls}
          />
        </div>
        <div>
          <label className={labelCls}>Date</label>
          <input type="date" {...register('date')} className={inputCls} />
        </div>
        <div>
          <label className={labelCls}>Notes</label>
          <input
            type="text"
            placeholder="Matin à jeun…"
            {...register('notes')}
            className={inputCls}
          />
        </div>
      </div>
      <button
        type="submit"
        disabled={isSubmitting}
        className="w-full rounded-lg bg-accent-vitality text-bg-DEFAULT font-bold py-2.5 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {isSubmitting && <Loader2 size={14} className="animate-spin" />}
        Enregistrer la mesure
      </button>
    </form>
  );
}

// ─── Measurement Chart ────────────────────────────────────────────────────────

function MeasurementChart() {
  const today = todayStr();
  const [metric, setMetric] = useState<MetricKey>('weight');
  const [data, setData] = useState<{ date: string; value: number }[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    const from = shiftDate(today, -90);
    apiFetch<{ items: { date: string; value: number }[] }>(
      `/measurements/${metric}?from=${from}&to=${today}`,
    )
      .then((res) => setData(res.items))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, [metric, today]);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-xs text-text-muted uppercase tracking-wide">Évolution</h4>
        <select
          value={metric}
          onChange={(e) => setMetric(e.target.value as MetricKey)}
          className="rounded bg-bg-strong border border-bg-strong text-xs text-text-DEFAULT px-2 py-1 outline-none focus:border-accent-vitality/50"
        >
          {METRICS.map((m) => (
            <option key={m} value={m}>{METRIC_LABELS[m]}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-40 text-text-muted">
          <Loader2 size={18} className="animate-spin" />
        </div>
      ) : data.length === 0 ? (
        <div className="rounded-lg border border-bg-strong bg-bg-subtle p-8 text-center">
          <p className="text-text-muted text-sm">
            Aucune mesure enregistrée pour {METRIC_LABELS[metric].toLowerCase()} ces 90 derniers jours.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4">
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#21262d" />
              <XAxis
                dataKey="date"
                tick={{ fill: '#8b949e', fontSize: 10 }}
                tickFormatter={(v: string) => v.slice(5)}
              />
              <YAxis tick={{ fill: '#8b949e', fontSize: 10 }} domain={['auto', 'auto']} />
              <Tooltip
                contentStyle={{
                  background: '#161b22',
                  border: '1px solid #21262d',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                labelStyle={{ color: '#8b949e' }}
                itemStyle={{ color: '#4ade80' }}
              />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#4ade80"
                strokeWidth={2}
                dot={{ r: 3, fill: '#4ade80' }}
                activeDot={{ r: 5 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
