'use client';
import { startLogin } from '@/lib/auth';

export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-3xl font-display tracking-wide">LIFE_OS</h1>
        <p className="text-text-muted">Personal life dashboard.</p>
        <button
          onClick={() => startLogin()}
          className="px-6 py-3 rounded bg-accent-xp/20 border border-accent-xp text-accent-xp hover:bg-accent-xp/30"
        >
          Se connecter
        </button>
      </div>
    </main>
  );
}
