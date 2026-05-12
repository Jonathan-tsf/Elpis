'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Mic, MicOff, Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { apiFetch } from '@/lib/api-client';

// ─── Types ───────────────────────────────────────────────────────────────────

type RecorderState =
  | 'idle'
  | 'recording'
  | 'uploading'
  | 'transcribing'
  | 'parsing'
  | 'ready'
  | 'error';

interface ParsedDraft {
  daily_log_draft: {
    sleep?: { duration_min: number; quality?: number; bedtime?: string; wake_time?: string };
    mood?: { mood: number; energy: number; focus: number; notes?: string };
    hydration_l?: number;
    skincare?: { am?: boolean; pm?: boolean; notes?: string };
    supplements?: { name: string; dose?: string }[];
    meals?: { slot: string; description: string; score?: number }[];
    notes?: string;
  };
  workout_draft?: Record<string, unknown>;
  notes: string[];
}

interface VoiceJobStatusResponse {
  status: 'none' | 'uploaded' | 'transcribing' | 'parsing' | 'ready' | 'error';
  draft?: ParsedDraft;
  transcript?: string;
  error?: string;
}

interface PresignResponse {
  key: string;
  uploadUrl: string;
}

export interface VoiceRecorderProps {
  date: string;
  onApplyDraft: (draft: ParsedDraft['daily_log_draft']) => void;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatSeconds(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, '0')}`;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function VoiceRecorder({ date, onApplyDraft }: VoiceRecorderProps) {
  const [state, setState] = useState<RecorderState>('idle');
  const [elapsed, setElapsed] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState<ParsedDraft | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (pollRef.current) clearInterval(pollRef.current);
      streamRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const startPolling = useCallback(
    (jobDate: string) => {
      if (pollRef.current) clearInterval(pollRef.current);
      pollRef.current = setInterval(async () => {
        try {
          const status = await apiFetch<VoiceJobStatusResponse>(
            `/voice-journal/${jobDate}/status`,
          );
          if (status.status === 'parsing') {
            setState('parsing');
          } else if (status.status === 'ready') {
            clearInterval(pollRef.current!);
            setDraft(status.draft ?? null);
            setState('ready');
          } else if (status.status === 'error') {
            clearInterval(pollRef.current!);
            setErrorMsg(status.error ?? 'Erreur inconnue');
            setState('error');
          }
          // Keep polling if transcribing
        } catch {
          // ignore transient errors
        }
      }, 2000);
    },
    [],
  );

  const handleStartRecording = async () => {
    setErrorMsg(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/webm';
      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.start(250);
      setState('recording');
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((s) => s + 1), 1000);
    } catch {
      setErrorMsg("Permission micro refusée ou microphone non disponible.");
      setState('error');
    }
  };

  const handleStopRecording = async () => {
    if (!mediaRecorderRef.current) return;
    if (timerRef.current) clearInterval(timerRef.current);

    // Stop recorder + get blob
    await new Promise<void>((resolve) => {
      const rec = mediaRecorderRef.current!;
      rec.onstop = () => resolve();
      rec.stop();
    });
    streamRef.current?.getTracks().forEach((t) => t.stop());

    const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
    setState('uploading');

    try {
      // 1. Get presigned URL
      const { key, uploadUrl } = await apiFetch<PresignResponse>('/voice-journal/presign', {
        method: 'POST',
        body: JSON.stringify({ contentType: 'audio/webm' }),
      });

      // 2. Upload directly to S3
      const uploadRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'audio/webm' },
      });
      if (!uploadRes.ok) throw new Error(`S3 upload failed: ${uploadRes.status}`);

      // 3. Start transcription job
      await apiFetch('/voice-journal/start', {
        method: 'POST',
        body: JSON.stringify({ key, date }),
      });

      setState('transcribing');
      startPolling(date);
    } catch (e) {
      setErrorMsg(e instanceof Error ? e.message : "Erreur lors de l'upload.");
      setState('error');
    }
  };

  const handleReset = () => {
    if (pollRef.current) clearInterval(pollRef.current);
    setDraft(null);
    setErrorMsg(null);
    setState('idle');
  };

  const handleApply = () => {
    if (draft) onApplyDraft(draft.daily_log_draft);
  };

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-bg-strong bg-bg-subtle p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Mic size={14} className="text-accent-spirit" />
        <span className="font-display tracking-widest text-xs text-accent-spirit uppercase">
          Journal vocal
        </span>
      </div>

      {state === 'idle' && (
        <button
          onClick={handleStartRecording}
          className="flex items-center gap-2 rounded-lg bg-accent-spirit/10 border border-accent-spirit/30 text-accent-spirit px-4 py-2 text-sm hover:bg-accent-spirit/20 transition-colors"
        >
          <Mic size={16} />
          Commencer l&apos;enregistrement
        </button>
      )}

      {state === 'recording' && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <span className="inline-block w-2 h-2 rounded-full bg-red-500 animate-pulse" />
            <span className="text-sm text-text-DEFAULT font-mono">{formatSeconds(elapsed)}</span>
            <div className="flex gap-0.5 items-end h-4">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="w-1 bg-accent-spirit rounded-sm animate-pulse"
                  style={{
                    height: `${20 + Math.sin((i + elapsed) * 0.8) * 40}%`,
                    animationDelay: `${i * 80}ms`,
                  }}
                />
              ))}
            </div>
          </div>
          <button
            onClick={handleStopRecording}
            className="flex items-center gap-2 rounded-lg bg-red-500/10 border border-red-500/40 text-red-400 px-4 py-2 text-sm hover:bg-red-500/20 transition-colors"
          >
            <MicOff size={16} />
            Arrêter
          </button>
        </div>
      )}

      {(state === 'uploading' || state === 'transcribing' || state === 'parsing') && (
        <div className="flex items-center gap-3 text-sm text-text-muted">
          <Loader2 size={16} className="animate-spin text-accent-spirit" />
          {state === 'uploading' && 'Upload en cours…'}
          {state === 'transcribing' && 'Transcription en cours… (~30s)'}
          {state === 'parsing' && "Analyse par l'IA…"}
        </div>
      )}

      {state === 'ready' && draft && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-accent-spirit">
            <CheckCircle size={14} />
            <span>Analyse terminée</span>
          </div>

          <DraftPreview draft={draft.daily_log_draft} />

          <div className="flex gap-2">
            <button
              onClick={handleApply}
              className="rounded bg-accent-spirit text-bg-DEFAULT text-xs font-bold px-4 py-2 hover:opacity-90 transition-opacity"
            >
              Appliquer au formulaire
            </button>
            <button
              onClick={handleReset}
              className="rounded border border-bg-strong text-text-muted text-xs px-4 py-2 hover:text-text-DEFAULT transition-colors"
            >
              Effacer
            </button>
          </div>
        </div>
      )}

      {state === 'error' && (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm text-red-400">
            <AlertCircle size={14} />
            <span>{errorMsg ?? 'Une erreur est survenue.'}</span>
          </div>
          <button
            onClick={handleReset}
            className="text-xs text-accent-spirit hover:underline"
          >
            Réessayer
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Draft Preview ────────────────────────────────────────────────────────────

function DraftPreview({ draft }: { draft: ParsedDraft['daily_log_draft'] }) {
  const lines: string[] = [];

  if (draft.sleep) {
    const h = Math.floor(draft.sleep.duration_min / 60);
    const m = draft.sleep.duration_min % 60;
    lines.push(`Sommeil: ${h}h${m > 0 ? `${m}min` : ''}`);
  }
  if (draft.mood) {
    lines.push(`Humeur: ${draft.mood.mood}/10 · Énergie: ${draft.mood.energy}/10 · Focus: ${draft.mood.focus}/10`);
  }
  if (draft.hydration_l != null) {
    lines.push(`Hydratation: ${draft.hydration_l}L`);
  }
  if (draft.skincare) {
    const parts = [];
    if (draft.skincare.am) parts.push('AM');
    if (draft.skincare.pm) parts.push('PM');
    if (parts.length) lines.push(`Skincare: ${parts.join(' + ')}`);
  }
  if (draft.meals?.length) {
    lines.push(`Repas: ${draft.meals.map((m) => m.slot).join(', ')}`);
  }
  if (draft.supplements?.length) {
    lines.push(`Suppléments: ${draft.supplements.map((s) => s.name).join(', ')}`);
  }

  if (lines.length === 0) {
    return (
      <p className="text-xs text-text-muted italic">
        Rien de détecté — vérifie la transcription.
      </p>
    );
  }

  return (
    <ul className="space-y-1">
      {lines.map((line, i) => (
        <li key={i} className="text-xs text-text-DEFAULT flex items-start gap-1.5">
          <span className="text-accent-spirit mt-0.5">•</span>
          {line}
        </li>
      ))}
    </ul>
  );
}
