'use client';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';

export default function Dashboard() {
  const [sub, setSub] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  useEffect(() => {
    apiFetch<{ sub: string }>('/me')
      .then((r) => setSub(r.sub))
      .catch((e) => setErr(String(e)));
  }, []);
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-display tracking-wider">Dashboard</h1>
      <p className="text-text-muted">Phase 0 — coquille uniquement.</p>
      <div className="rounded border border-bg-strong p-4">
        <div className="text-xs uppercase text-text-muted">/me response</div>
        <div className="font-mono text-sm">{sub ?? err ?? 'loading…'}</div>
      </div>
    </div>
  );
}
