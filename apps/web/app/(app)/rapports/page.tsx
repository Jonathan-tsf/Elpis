'use client';
import { useEffect, useState } from 'react';
import { Loader2, ArrowLeft } from 'lucide-react';
import { toast } from 'sonner';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { apiFetch } from '@/lib/api-client';

type AnalysisScope = 'sleep' | 'workouts' | 'looksmax' | 'global';

interface AnalysisSummary {
  id: string;
  scope: AnalysisScope;
  days: number;
  created_at: string;
  markdown: string;
}

interface AnalysisDetail extends AnalysisSummary {}

const SCOPE_LABELS: Record<AnalysisScope, string> = {
  sleep: 'Sommeil',
  workouts: 'Entraînements',
  looksmax: 'Looksmax',
  global: 'Global',
};

function snippet(text: string, max = 120): string {
  const first = text.split('\n').find((l) => l.trim().length > 0) ?? '';
  return first.length > max ? first.slice(0, max) + '…' : first;
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat('fr-FR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(iso));
}

export default function RapportsPage() {
  const [reports, setReports] = useState<AnalysisSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<AnalysisDetail | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  useEffect(() => {
    apiFetch<{ items: AnalysisSummary[] }>('/analysis')
      .then((res) => {
        const sorted = [...res.items].sort((a, b) =>
          a.created_at < b.created_at ? 1 : -1,
        );
        setReports(sorted);
      })
      .catch(() => toast.error('Erreur lors du chargement des rapports.'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setDetail(null);
      return;
    }
    setLoadingDetail(true);
    apiFetch<AnalysisDetail>(`/analysis/${selectedId}`)
      .then((res) => setDetail(res))
      .catch(() => {
        toast.error('Erreur lors du chargement du rapport.');
        setSelectedId(null);
      })
      .finally(() => setLoadingDetail(false));
  }, [selectedId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh] text-text-muted">
        <Loader2 size={20} className="animate-spin" />
      </div>
    );
  }

  // Detail view
  if (selectedId) {
    return (
      <div className="max-w-3xl space-y-6">
        <button
          type="button"
          onClick={() => setSelectedId(null)}
          className="flex items-center gap-2 text-sm text-text-muted hover:text-text-DEFAULT transition-colors"
        >
          <ArrowLeft size={14} />
          Retour aux rapports
        </button>

        {loadingDetail ? (
          <div className="flex items-center justify-center h-40 text-text-muted">
            <Loader2 size={20} className="animate-spin" />
          </div>
        ) : detail ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-display tracking-widest text-xs text-accent-xp uppercase">
                {SCOPE_LABELS[detail.scope]}
              </span>
              <span className="text-xs text-text-muted font-mono">
                {formatDate(detail.created_at)}
              </span>
              <span className="text-xs text-text-muted">— {detail.days} jours</span>
            </div>

            <div className="rounded-lg border border-bg-strong bg-bg-subtle p-6">
              <div className="prose prose-invert prose-sm max-w-none text-text-DEFAULT
                [&_h1]:font-display [&_h1]:tracking-widest [&_h1]:text-accent-xp [&_h1]:text-lg
                [&_h2]:font-display [&_h2]:tracking-wider [&_h2]:text-text-DEFAULT [&_h2]:text-base
                [&_h3]:text-text-DEFAULT [&_h3]:font-semibold
                [&_strong]:text-text-DEFAULT
                [&_ul]:list-disc [&_ul]:pl-5
                [&_ol]:list-decimal [&_ol]:pl-5
                [&_li]:text-text-DEFAULT [&_li]:my-0.5
                [&_p]:text-text-DEFAULT [&_p]:leading-relaxed
                [&_code]:bg-bg-strong [&_code]:px-1 [&_code]:rounded [&_code]:text-accent-spirit [&_code]:text-xs
                [&_blockquote]:border-l-2 [&_blockquote]:border-accent-xp/40 [&_blockquote]:pl-3 [&_blockquote]:text-text-muted
                [&_hr]:border-bg-strong">
                <ReactMarkdown remarkPlugins={[remarkGfm]}>
                  {detail.markdown}
                </ReactMarkdown>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  // List view
  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="font-display tracking-widest text-2xl text-text-DEFAULT">Rapports</h1>

      {reports.length === 0 ? (
        <div className="rounded-lg border border-bg-strong bg-bg-subtle p-8 text-center space-y-3">
          <div className="text-3xl">📊</div>
          <p className="text-text-muted text-sm">
            Aucun rapport généré. Lance une &quot;Analyse profonde&quot; depuis Stats, Workouts ou Looksmax.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <button
              key={r.id}
              type="button"
              onClick={() => setSelectedId(r.id)}
              className="w-full text-left rounded-lg border border-bg-strong bg-bg-subtle hover:bg-bg-strong transition-colors p-4 space-y-1.5"
            >
              <div className="flex items-center gap-3">
                <span className="font-display tracking-widest text-xs text-accent-xp uppercase">
                  {SCOPE_LABELS[r.scope]}
                </span>
                <span className="text-xs text-text-muted font-mono">
                  {formatDate(r.created_at)}
                </span>
                <span className="text-xs text-text-muted ml-auto">{r.days}j</span>
              </div>
              <p className="text-sm text-text-muted truncate">
                {snippet(r.markdown)}
              </p>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
