'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { handleCallback } from '@/lib/auth';

export default function CallbackPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const search = new URLSearchParams(window.location.search);
    const code = search.get('code');
    const state = search.get('state');
    const oauthError = search.get('error');

    if (oauthError) {
      setError(`Cognito a refusé : ${oauthError}`);
      return;
    }
    if (!code || !state) {
      setError("Paramètres manquants dans l'URL de callback.");
      return;
    }

    handleCallback(code, state)
      .then(() => router.replace('/dashboard'))
      .catch((e) => setError(String(e)));
  }, [router]);

  if (error) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center gap-4 p-8 font-mono">
        <h1 className="text-2xl text-accent-force">Échec de connexion</h1>
        <pre className="text-sm text-text-muted whitespace-pre-wrap max-w-2xl">{error}</pre>
        <a href="/login" className="text-accent-spirit underline">
          Réessayer
        </a>
      </main>
    );
  }

  return (
    <main className="min-h-screen flex items-center justify-center text-text-muted">
      Connexion en cours…
    </main>
  );
}
