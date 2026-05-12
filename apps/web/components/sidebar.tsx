'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Mic,
  BarChart3,
  Dumbbell,
  Sparkles,
  CalendarRange,
  Trophy,
  MessageSquare,
  FileText,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

const items = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/journal', label: 'Journal', icon: Mic },
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/workouts', label: 'Workouts', icon: Dumbbell },
  { href: '/looksmax', label: 'Looksmax', icon: Sparkles },
  { href: '/saison', label: 'Saison', icon: CalendarRange },
  { href: '/trophees', label: 'Trophées', icon: Trophy },
  { href: '/coach', label: 'Coach', icon: MessageSquare },
  { href: '/rapports', label: 'Rapports', icon: FileText },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();
  return (
    <aside className="w-56 min-h-screen border-r border-bg-strong bg-bg-subtle py-6 px-3 flex flex-col gap-1">
      <div className="px-3 mb-6 font-display tracking-widest text-accent-spirit">LIFE_OS</div>
      {items.map(({ href, label, icon: Icon }) => {
        const active = path === href || path.startsWith(href + '/');
        return (
          <Link
            key={href}
            href={href}
            className={clsx(
              'flex items-center gap-3 px-3 py-2 rounded text-sm hover:bg-bg-strong',
              active && 'bg-bg-strong text-accent-spirit',
            )}
          >
            <Icon size={16} />
            <span>{label}</span>
          </Link>
        );
      })}
    </aside>
  );
}
