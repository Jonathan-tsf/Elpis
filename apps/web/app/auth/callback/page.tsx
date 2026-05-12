'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Hub } from 'aws-amplify/utils';

export default function CallbackPage() {
  const router = useRouter();
  useEffect(() => {
    const sub = Hub.listen('auth', ({ payload }) => {
      if (payload.event === 'signedIn') router.replace('/dashboard');
      if (payload.event === 'signInWithRedirect_failure') router.replace('/login?error=1');
    });
    return () => sub();
  }, [router]);
  return <main className="min-h-screen flex items-center justify-center text-text-muted">Connexion en cours…</main>;
}
