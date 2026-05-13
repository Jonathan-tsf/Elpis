'use client';
import { useEffect, useState } from 'react';
import { Loader2, Plus, X, Camera } from 'lucide-react';
import { toast } from 'sonner';
import Link from 'next/link';
import { apiFetch } from '@/lib/api-client';
import { todayStr, formatHumanDate } from '@/lib/dates';
import type { DailyLog, Streak, Photo } from '@lifeos/shared';

const inputCls =
  'w-full rounded bg-bg-strong border border-bg-strong focus:border-accent-appearance/50 outline-none px-3 py-2 text-sm text-text-DEFAULT placeholder:text-text-muted';

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="font-display tracking-widest text-xs text-accent-appearance uppercase border-b border-bg-strong pb-1 mb-3">
      {children}
    </h3>
  );
}

interface SkincareState {
  am: boolean;
  pm: boolean;
  notes: string;
  products: string[];
}

export default function SkincarePage() {
  const today = todayStr();
  const [state, setState] = useState<SkincareState>({
    am: false,
    pm: false,
    notes: '',
    products: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [streaks, setStreaks] = useState<Streak[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [newProduct, setNewProduct] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const [logRes, streaksRes, photosRes] = await Promise.allSettled([
          apiFetch<DailyLog & { skincare?: { am: boolean; pm: boolean; notes?: string; products?: string[] } }>(`/daily-log/${today}`),
          apiFetch<{ streaks: Streak[] }>('/streaks'),
          apiFetch<{ items: Photo[] }>('/photos?tag=skin'),
        ]);

        if (logRes.status === 'fulfilled' && logRes.value.skincare) {
          const s = logRes.value.skincare;
          setState({
            am: s.am ?? false,
            pm: s.pm ?? false,
            notes: s.notes ?? '',
            products: (s as { products?: string[] }).products ?? [],
          });
        }
        if (streaksRes.status === 'fulfilled') {
          setStreaks(streaksRes.value.streaks ?? []);
        }
        if (photosRes.status === 'fulfilled') {
          setPhotos(photosRes.value.items ?? []);
        }
      } catch {
        // silently handled
      } finally {
        setLoading(false);
      }
    };
    load();
  }, [today]);

  const saveLog = async (updates: Partial<SkincareState>) => {
    const merged = { ...state, ...updates };
    setSaving(true);
    try {
      await apiFetch(`/daily-log/${today}`, {
        method: 'PUT',
        body: JSON.stringify({
          skincare: {
            am: merged.am,
            pm: merged.pm,
            ...(merged.notes ? { notes: merged.notes } : {}),
            ...(merged.products.length ? { products: merged.products } : {}),
          },
        }),
      });
      setState(merged);
      toast.success('Skincare enregistrée');
    } catch {
      toast.error('Erreur de sauvegarde');
    } finally {
      setSaving(false);
    }
  };

  const amStreak = streaks.find((s) => s.category === 'skincare_am');
  const pmStreak = streaks.find((s) => s.category === 'skincare_pm');

  const addProduct = () => {
    if (!newProduct.trim()) return;
    const updated = [...state.products, newProduct.trim()];
    setNewProduct('');
    setState((s) => ({ ...s, products: updated }));
  };

  const removeProduct = (idx: number) => {
    const updated = state.products.filter((_, i) => i !== idx);
    setState((s) => ({ ...s, products: updated }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-xl space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Skincare</h1>
        <span className="text-xs text-text-muted font-mono">{formatHumanDate(today)}</span>
      </div>

      {/* Routine du jour */}
      <section>
        <SectionHeading>Routine du jour</SectionHeading>
        <div className="grid grid-cols-2 gap-3">
          {/* AM Toggle */}
          <button
            type="button"
            onClick={() => saveLog({ am: !state.am })}
            disabled={saving}
            className={`rounded-xl border-2 p-5 flex flex-col items-center gap-2 transition-colors ${
              state.am
                ? 'border-accent-appearance bg-accent-appearance/10 text-accent-appearance'
                : 'border-bg-strong bg-bg-subtle text-text-muted hover:border-accent-appearance/50'
            }`}
          >
            <span className="text-2xl">🌅</span>
            <span className="text-sm font-bold">Routine AM</span>
            <span className="text-xs">{state.am ? 'Faite ✓' : 'À faire'}</span>
            {amStreak && amStreak.current > 0 && (
              <span className="text-xs font-mono">{amStreak.current}j 🔥</span>
            )}
          </button>

          {/* PM Toggle */}
          <button
            type="button"
            onClick={() => saveLog({ pm: !state.pm })}
            disabled={saving}
            className={`rounded-xl border-2 p-5 flex flex-col items-center gap-2 transition-colors ${
              state.pm
                ? 'border-accent-appearance bg-accent-appearance/10 text-accent-appearance'
                : 'border-bg-strong bg-bg-subtle text-text-muted hover:border-accent-appearance/50'
            }`}
          >
            <span className="text-2xl">🌙</span>
            <span className="text-sm font-bold">Routine PM</span>
            <span className="text-xs">{state.pm ? 'Faite ✓' : 'À faire'}</span>
            {pmStreak && pmStreak.current > 0 && (
              <span className="text-xs font-mono">{pmStreak.current}j 🔥</span>
            )}
          </button>
        </div>
      </section>

      {/* Produits utilisés */}
      <section>
        <SectionHeading>Produits utilisés</SectionHeading>
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {state.products.map((p, i) => (
              <span
                key={i}
                className="flex items-center gap-1 rounded-full bg-bg-strong border border-bg-strong px-3 py-1 text-xs text-text-DEFAULT"
              >
                {p}
                <button type="button" onClick={() => removeProduct(i)} className="text-text-muted hover:text-accent-force ml-1">
                  <X size={10} />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newProduct}
              onChange={(e) => setNewProduct(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') { e.preventDefault(); addProduct(); }
              }}
              placeholder="Niacinamide, Retinol…"
              className={inputCls}
            />
            <button
              type="button"
              onClick={addProduct}
              className="rounded bg-bg-strong border border-bg-strong px-3 py-2 text-sm text-text-muted hover:text-text-DEFAULT flex items-center gap-1"
            >
              <Plus size={14} />
            </button>
          </div>
        </div>
      </section>

      {/* Notes skincare */}
      <section>
        <SectionHeading>Notes skincare</SectionHeading>
        <textarea
          rows={3}
          value={state.notes}
          onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
          placeholder="Observations sur ta peau du jour…"
          className={inputCls}
        />
      </section>

      {/* Sauvegarder notes + products */}
      <button
        type="button"
        onClick={() => saveLog({})}
        disabled={saving}
        className="w-full rounded-lg bg-accent-appearance text-bg-DEFAULT font-bold py-3 text-sm tracking-wider hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center justify-center gap-2"
      >
        {saving && <Loader2 size={16} className="animate-spin" />}
        Enregistrer
      </button>

      {/* Photos peau */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <SectionHeading>Photos peau</SectionHeading>
          <Link href="/looksmax" className="text-xs text-accent-appearance hover:opacity-80 flex items-center gap-1">
            <Camera size={12} /> Ajouter →
          </Link>
        </div>
        {photos.length === 0 ? (
          <div className="rounded-lg border border-bg-strong bg-bg-subtle p-6 text-center">
            <p className="text-text-muted text-sm">Aucune photo tagguée «skin».</p>
            <Link href="/looksmax" className="text-xs text-accent-appearance mt-1 block hover:underline">
              Aller dans Looksmax pour en ajouter →
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {photos.slice(0, 9).map((photo) => (
              <div key={photo.id} className="aspect-square rounded-lg overflow-hidden bg-bg-strong border border-bg-strong flex items-center justify-center">
                <span className="text-xs text-text-muted font-mono text-center px-2">{photo.date}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
