'use client';
import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';

interface BriefingResponse {
  date: string;
  text: string | null;
}

export function BriefingCard() {
  const [briefing, setBriefing] = useState<BriefingResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    apiFetch<BriefingResponse>('/briefings/today')
      .then((res) => setBriefing(res))
      .catch(() => setBriefing({ date: new Date().toISOString().slice(0, 10), text: null }))
      .finally(() => setLoading(false));
  }, []);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await apiFetch<BriefingResponse>('/briefings/generate', { method: 'POST' });
      setBriefing(res);
      toast.success('Briefing généré !');
    } catch {
      toast.error('Erreur lors de la génération du briefing.');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4 flex items-center justify-center h-20">
        <Loader2 size={18} className="animate-spin text-text-muted" />
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-bg-strong bg-bg-subtle p-5 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="font-display tracking-widest text-xs text-accent-xp uppercase">
          🌅 Briefing du matin
        </h2>
        {briefing?.date && (
          <span className="text-xs text-text-muted font-mono">{briefing.date}</span>
        )}
      </div>

      {/* Body */}
      {briefing?.text ? (
        <>
          <p className="text-sm text-text-DEFAULT leading-relaxed whitespace-pre-line">
            {briefing.text}
          </p>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="text-xs text-accent-xp/70 hover:text-accent-xp transition-colors flex items-center gap-1 disabled:opacity-50"
          >
            {generating && <Loader2 size={11} className="animate-spin" />}
            Régénérer
          </button>
        </>
      ) : (
        <div className="flex flex-col items-start gap-3">
          <p className="text-sm text-text-muted">Aucun briefing pour aujourd&apos;hui.</p>
          <button
            type="button"
            onClick={generate}
            disabled={generating}
            className="flex items-center gap-2 rounded-lg bg-accent-xp/10 border border-accent-xp/30 text-accent-xp text-sm px-4 py-2 hover:bg-accent-xp/20 transition-colors disabled:opacity-50"
          >
            {generating ? (
              <Loader2 size={14} className="animate-spin" />
            ) : (
              '✨'
            )}
            Générer le briefing
          </button>
        </div>
      )}
    </div>
  );
}
