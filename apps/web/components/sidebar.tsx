'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Home,
  Dumbbell,
  Sparkles,
  Zap,
  Moon,
  BarChart3,
  Camera,
  CalendarRange,
  Trophy,
  FileText,
  Settings,
} from 'lucide-react';
import clsx from 'clsx';

const major = [
  { href: '/dashboard', label: 'Dashboard', icon: Home },
  { href: '/sport', label: 'Sport', icon: Dumbbell },
  { href: '/skincare', label: 'Skincare', icon: Sparkles },
  { href: '/habitudes', label: 'Habitudes', icon: Zap },
  { href: '/sommeil', label: 'Sommeil', icon: Moon },
];

const secondary = [
  { href: '/stats', label: 'Stats', icon: BarChart3 },
  { href: '/looksmax', label: 'Looksmax', icon: Camera },
  { href: '/saison', label: 'Saison', icon: CalendarRange },
  { href: '/trophees', label: 'Trophées', icon: Trophy },
  { href: '/rapports', label: 'Rapports', icon: FileText },
  { href: '/settings', label: 'Réglages', icon: Settings },
];

export function Sidebar() {
  const path = usePathname();

  const isActive = (href: string) => path === href || path.startsWith(href + '/');

  return (
    <aside className="w-56 min-h-screen border-r border-bg-strong bg-bg-subtle py-6 px-3 flex flex-col gap-1 shrink-0">
      <div className="px-3 mb-6 font-display tracking-widest text-accent-spirit">LIFE_OS</div>

      {/* Major navigation */}
      {major.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={clsx(
            'flex items-center gap-3 px-3 py-2.5 rounded text-sm font-medium hover:bg-bg-strong transition-colors',
            isActive(href) && 'bg-bg-strong text-accent-spirit',
          )}
        >
          <Icon size={18} />
          <span>{label}</span>
        </Link>
      ))}

      {/* Divider */}
      <div className="my-3 border-t border-bg-strong" />

      {/* Secondary navigation */}
      <div className="px-3 mb-1 text-[10px] font-bold tracking-widest text-text-muted uppercase">
        Autres
      </div>
      {secondary.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          className={clsx(
            'flex items-center gap-2.5 px-3 py-1.5 rounded text-xs text-text-muted hover:bg-bg-strong hover:text-text-DEFAULT transition-colors',
            isActive(href) && 'bg-bg-strong text-accent-spirit',
          )}
        >
          <Icon size={14} />
          <span>{label}</span>
        </Link>
      ))}
    </aside>
  );
}
