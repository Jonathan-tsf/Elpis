'use client';
import { useEffect, useState } from 'react';
import { Loader2, FlaskConical, ChevronDown, ChevronUp } from 'lucide-react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import type { Photo, PhotoAnalysis } from '@lifeos/shared';

export function PhotoTile({ photo }: { photo: Photo }) {
  const [url, setUrl] = useState<string | null>(null);
  const [analysing, setAnalysing] = useState(false);
  const [analysis, setAnalysis] = useState<PhotoAnalysis | null>(null);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [pastAnalyses, setPastAnalyses] = useState<PhotoAnalysis[]>([]);
  const [loadingPast, setLoadingPast] = useState(false);

  useEffect(() => {
    apiFetch<{ url: string }>(`/photos/${photo.id}/url`)
      .then((r) => setUrl(r.url))
      .catch(() => setUrl(null));
  }, [photo.id]);

  const handleAnalyse = async () => {
    setAnalysing(true);
    try {
      const res = await apiFetch<PhotoAnalysis>(`/photos/${photo.id}/analyze`, {
        method: 'POST',
        body: JSON.stringify({ scope: 'auto' }),
      });
      setAnalysis(res);
      setShowAnalysis(true);
    } catch {
      toast.error("Erreur lors de l'analyse.");
    } finally {
      setAnalysing(false);
    }
  };

  const loadPastAnalyses = async () => {
    if (pastAnalyses.length > 0) {
      setShowAnalysis(!showAnalysis);
      return;
    }
    setLoadingPast(true);
    try {
      const res = await apiFetch<{ analyses: PhotoAnalysis[] }>(`/photos/${photo.id}/analyses`);
      setPastAnalyses(res.analyses);
      setShowAnalysis(true);
    } catch {
      toast.error('Erreur lors du chargement des analyses.');
    } finally {
      setLoadingPast(false);
    }
  };

  const activeAnalysis = analysis ?? pastAnalyses[pastAnalyses.length - 1] ?? null;

  return (
    <div className="rounded-lg overflow-hidden border border-bg-strong bg-bg-subtle">
      <div className="aspect-square bg-bg-strong relative">
        {url ? (
          <img src={url} alt={photo.tags.join(', ')} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-text-muted text-2xl">
            📷
          </div>
        )}
      </div>
      <div className="p-2 text-xs text-text-muted space-y-1.5">
        <div className="font-mono">{photo.date}</div>
        <div className="truncate text-text-DEFAULT/70">{photo.tags.join(' • ')}</div>
        <div className="flex items-center gap-1 pt-0.5">
          <button
            type="button"
            onClick={handleAnalyse}
            disabled={analysing}
            className="flex items-center gap-1 text-xs text-accent-appearance hover:text-accent-appearance/80 disabled:opacity-50"
          >
            {analysing ? <Loader2 size={10} className="animate-spin" /> : <FlaskConical size={10} />}
            Analyser
          </button>
          <button
            type="button"
            onClick={loadPastAnalyses}
            disabled={loadingPast}
            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-DEFAULT disabled:opacity-50 ml-auto"
          >
            {loadingPast ? <Loader2 size={10} className="animate-spin" /> : showAnalysis ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
            Historique
          </button>
        </div>
      </div>
      {showAnalysis && activeAnalysis && (
        <div className="border-t border-bg-strong p-3 text-xs text-text-DEFAULT space-y-1">
          <div className="text-text-muted font-mono mb-1">{activeAnalysis.date} — {activeAnalysis.scope}</div>
          <MarkdownPreview text={activeAnalysis.markdown} />
        </div>
      )}
    </div>
  );
}

function MarkdownPreview({ text }: { text: string }) {
  // Simple markdown renderer for key formatting (no external dep)
  const lines = text.split('\n');
  return (
    <div className="space-y-0.5 max-h-48 overflow-y-auto text-[11px] leading-relaxed">
      {lines.map((line, i) => {
        if (line.startsWith('## '))
          return <p key={i} className="font-semibold text-text-DEFAULT mt-1">{line.slice(3)}</p>;
        if (line.startsWith('# '))
          return <p key={i} className="font-bold text-text-DEFAULT mt-1">{line.slice(2)}</p>;
        if (line.startsWith('- ') || line.startsWith('* '))
          return <p key={i} className="text-text-muted pl-2">• {line.slice(2)}</p>;
        if (line.match(/^\d+\./))
          return <p key={i} className="text-text-muted pl-2">{line}</p>;
        if (line.trim() === '') return <div key={i} className="h-1" />;
        return <p key={i} className="text-text-muted">{line}</p>;
      })}
    </div>
  );
}
