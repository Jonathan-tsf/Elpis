'use client';
import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';

type AnalysisScope = 'sleep' | 'workouts' | 'looksmax' | 'global';

interface AnalyseButtonProps {
  scope: AnalysisScope;
  days?: number;
}

interface AnalysisRunResponse {
  id: string;
  scope: AnalysisScope;
  markdown: string;
  created_at: string;
}

export function AnalyseButton({ scope, days = 90 }: AnalyseButtonProps) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleClick = async () => {
    setLoading(true);
    try {
      await apiFetch<AnalysisRunResponse>('/analysis/run', {
        method: 'POST',
        body: JSON.stringify({ scope, days }),
      });
      toast.success('Analyse terminée ! Redirection vers les rapports…');
      router.push('/rapports');
    } catch {
      toast.error('Erreur lors de l\'analyse. Réessaie.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="flex items-center gap-2 rounded-lg border border-bg-strong bg-bg-subtle hover:bg-bg-strong text-text-DEFAULT text-sm px-4 py-2 transition-colors disabled:opacity-50"
    >
      {loading ? (
        <Loader2 size={14} className="animate-spin" />
      ) : (
        <span>🔬</span>
      )}
      {loading ? 'Analyse en cours…' : 'Analyse profonde'}
    </button>
  );
}
