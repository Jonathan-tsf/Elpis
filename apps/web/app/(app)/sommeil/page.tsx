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
import { todayStr, shiftDate, formatHumanDate } from '@/lib/dates';
import { showXpToast, type XpDelta } from '@/components/xp-toast';
import { AnalyseButton } from '@/components/analyse-button';
import type { DailyLog, Streak } from '@lifeos/shared';

// ─── Form schema ─────────────────────────────────────────────────────────────

const SleepFormSchema = z.object({
  sleep_h: z.coerce.number().int().min(0).max(24).optional(),
  sleep_min: z.coerce.number().int().min(0).max(59).optional(),
  sleep_quality: z.coerce.number().int().min(1).max(10).optional(),
  sleep_bedtime: z.string().optional(),
  sleep_wake: z.string().optional(),
});

type SleepFormValues = z.infer<typeof SleepFormSchema>;

interface PutLogResponse {
  date: string;
  xp_deltas: XpDelta[];
  stats: { global_level: number; global_xp: number };
}

interface SleepDataPoint {
  date: string;
  duration_h: number;
  quality: number | null;
}

// ─── Shared styles ─────────────────────────────────────────────────────────

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

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function SommeilPage() {
  const today = todayStr();
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [chartData, setChartData] = useState<SleepDataPoint[]>([]);
  const [chartLoading, setChartLoading] = useState(true);

  const {
    register,
    handleSubmit,
    reset,
    formState: { isSubmitting },
  } = useForm<SleepFormValues>({
    resolver: zodResolver(SleepFormSchema),
    defaultValues: { sleep_h: 0, sleep_min: 0 },
  });

  // Load existing log + streaks + history
  useEffect(() => {
    const loadAll = async () => {
      try {
        const [logRes, streaksRes] = await Promise.allSettled([
          apiFetch<DailyLog & { sleep?: { duration_min: number; quality?: number; bedtime?: string; wake_time?: string } }>(`/daily-log/${today}`),
          apiFetch<{ streaks: Streak[] }>('/streaks'),
        ]);

        if (logRes.status === 'fulfilled' && logRes.value.sleep) {
          const s = logRes.value.sleep;
          reset({
            sleep_h: Math.floor(s.duration_min / 60),
            sleep_min: s.duration_min % 60,
            sleep_quality: s.quality,
            sleep_bedtime: s.bedtime ?? '',
            sleep_wake: s.wake_time ?? '',
          });
        }
        if (streaksRes.status === 'fulfilled') {
          setStreaks(streaksRes.value.streaks ?? []);
        }
      } catch {
        // silently
      }
    };
    loadAll();
  }, [today, reset]);

  // Load 30-day sleep history for chart
  useEffect(() => {
    const loadHistory = async () => {
      try {
        const from = shiftDate(today, -29);
        const res = await apiFetch<{ items: (DailyLog & { date: string })[] }>(`/daily-log?from=${from}&to=${today}`);
        const points: SleepDataPoint[] = res.items
          .filter((l) => l.sleep)
          .map((l) => ({
            date: l.date,
            duration_h: l.sleep ? l.sleep.duration_min / 60 : 0,
            quality: l.sleep?.quality ?? null,
          }))
          .sort((a, b) => (a.date < b.date ? -1 : 1));
        setChartData(points);
      } catch {
        setChartData([]);
      } finally {
        setChartLoading(false);
      }
    };
    loadHistory();
  }, [today]);

  const onSubmit = async (values: SleepFormValues) => {
    const sleepH = values.sleep_h ?? 0;
    const sleepMin = values.sleep_min ?? 0;
    const body: Record<string, unknown> = {};

    if (sleepH > 0 || sleepMin > 0 || values.sleep_quality || values.sleep_bedtime || values.sleep_wake) {
      body.sleep = {
        duration_min: sleepH * 60 + sleepMin,
        ...(values.sleep_quality ? { quality: values.sleep_quality } : {}),
        ...(values.sleep_bedtime ? { bedtime: values.sleep_bedtime } : {}),
        ...(values.sleep_wake ? { wake_time: values.sleep_wake } : {}),
      };
    }

    try {
      const res = await apiFetch<PutLogResponse>(`/daily-log/${today}`, {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      const total = res.xp_deltas.reduce((s, d) => s + d.amount, 0);
      if (total > 0) showXpToast(res.xp_deltas, total);
      toast.success('Sommeil enregistré');
    } catch (e) {
      toast.error(`Erreur : ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const sleepStreak = streaks.find((s) => s.category === 'sleep_7h_plus');

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Sommeil</h1>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted font-mono">{formatHumanDate(today)}</span>
          <AnalyseButton scope="sleep" days={90} />
        </div>
      </div>

      {/* Sleep streak */}
      {sleepStreak && sleepStreak.current > 0 && (
        <div className="rounded-xl border border-accent-spirit/30 bg-accent-spirit/5 p-4 flex items-center gap-4">
          <span className="text-3xl">😴</span>
          <div>
            <div className="font-display tracking-wider text-accent-spirit text-sm">
              Série sommeil 7h+ — {sleepStreak.current} nuit{sleepStreak.current !== 1 ? 's' : ''}
            </div>
            <div className="text-xs text-text-muted">
              Meilleure série : {sleepStreak.longest} nuits
            </div>
          </div>
        </div>
      )}

      {/* Form */}
      <section>
        <SectionHeading>Nuit d&apos;aujourd&apos;hui</SectionHeading>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
            <div className="col-span-2 grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Coucher</label>
                <input type="time" {...register('sleep_bedtime')} className={inputCls} />
              </div>
              <div>
                <label className={labelCls}>Réveil</label>
                <input type="time" {...register('sleep_wake')} className={inputCls} />
              </div>
            </div>
          </div>
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-accent-spirit text-bg-DEFAULT font-bold py-3 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isSubmitting && <Loader2 size={16} className="animate-spin" />}
            Enregistrer le sommeil
          </button>
        </form>
      </section>

      {/* 30-day chart */}
      <section>
        <SectionHeading>Historique 30 jours</SectionHeading>
        {chartLoading ? (
          <div className="flex items-center justify-center h-40 text-text-muted">
            <Loader2 size={16} className="animate-spin" />
          </div>
        ) : chartData.length === 0 ? (
          <div className="rounded-lg border border-bg-strong bg-bg-subtle p-6 text-center">
            <p className="text-text-muted text-sm">Aucune donnée de sommeil sur 30 jours.</p>
          </div>
        ) : (
          <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: -20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  tickFormatter={(d: string) => d.slice(5)}
                />
                <YAxis
                  domain={[0, 12]}
                  tick={{ fontSize: 10, fill: 'rgba(255,255,255,0.4)' }}
                  tickFormatter={(v: number) => `${v}h`}
                />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a2e',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    fontSize: 12,
                  }}
                  formatter={(value) => [`${Number(value).toFixed(1)}h`, 'Durée']}
                  labelFormatter={(label) => formatHumanDate(String(label))}
                />
                <Line
                  type="monotone"
                  dataKey="duration_h"
                  stroke="#7c3aed"
                  strokeWidth={2}
                  dot={{ r: 3, fill: '#7c3aed' }}
                  activeDot={{ r: 5 }}
                />
                {/* 7h target line */}
                <Line
                  type="monotone"
                  dataKey={() => 7}
                  stroke="rgba(124,58,237,0.3)"
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  dot={false}
                  name="Objectif 7h"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
}
