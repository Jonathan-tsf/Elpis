'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { Sidebar } from '@/components/sidebar';
import { Toaster } from 'sonner';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      const u = await currentUser();
      if (!u) router.replace('/login');
      else setReady(true);
    })();
  }, [router]);
  if (!ready)
    return (
      <div className="min-h-screen flex items-center justify-center text-text-muted">…</div>
    );
  return (
    <div className="flex">
      <Sidebar />
      <main className="flex-1 min-h-screen p-8">{children}</main>
      <Toaster position="bottom-right" theme="dark" richColors />
    </div>
  );
}
