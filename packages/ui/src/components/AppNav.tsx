'use client';

import type { LucideIcon } from 'lucide-react';
import { Home, Library, Music, User } from 'lucide-react';
import type { ComponentType } from 'react';

import { cn } from '../lib/cn';

/**
 * Navigation shells.
 *
 * One `NavItem` model drives both presentations, so mobile and desktop can
 * never drift apart: the mobile tab bar and the desktop sidebar are the same
 * data rendered two ways.
 *
 * Deliberately router-agnostic — the active route arrives as a prop rather than
 * from `next/navigation`, because this package is also loaded by the Tauri
 * shell, which runs on Vite and has no Next router.
 */

export interface NavItem {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
  /** Hidden from the mobile tab bar (secondary destinations). */
  desktopOnly?: boolean;
}

export const DEFAULT_NAV_ITEMS: NavItem[] = [
  { id: 'home', label: 'Home', href: '/app/dashboard', icon: Home },
  { id: 'search', label: 'Search', href: '/app/search', icon: Music },
  { id: 'library', label: 'Library', href: '/app/library', icon: Library },
  { id: 'profile', label: 'Profile', href: '/app/settings', icon: User },
];

function isActive(pathname: string | null, href: string): boolean {
  if (pathname === null) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Floating pill tab bar for mobile. The active tab is a lime circle with dark
 * glyph; the rest are ghost. Sits above the safe-area inset so it clears the
 * home indicator on iOS.
 */
export function MobileTabBar({
  items = DEFAULT_NAV_ITEMS,
  pathname,
  className,
}: {
  items?: NavItem[];
  pathname?: string | null;
  className?: string;
}) {
  const active = pathname ?? null;
  const visible = items.filter((item) => item.desktopOnly !== true);

  return (
    <nav
      aria-label="Primary"
      className={cn(
        'fixed inset-x-0 bottom-0 z-40 flex justify-center',
        'pb-[max(0.75rem,env(safe-area-inset-bottom))]',
        className,
      )}
    >
      <ul className="glass flex items-center gap-1 rounded-pill border border-border-subtle p-1.5 shadow-overlay">
        {visible.map((item) => {
          const activeTab = isActive(active, item.href);
          const Icon = item.icon;

          return (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={activeTab ? 'page' : undefined}
                className={cn(
                  'flex size-12 items-center justify-center rounded-pill',
                  'transition-colors duration-150 ease-out',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  activeTab
                    ? 'bg-accent text-accent-ink shadow-glow'
                    : 'text-text-mid hover:text-text-high',
                )}
              >
                <Icon aria-hidden className="size-6" />
                {/* The label is for assistive tech and tooltips; the pill is icon-led. */}
                <span className="sr-only">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/**
 * Desktop sidebar. Collapses to icon-only below `lg`, and is hidden entirely on
 * mobile where the floating tab bar takes over.
 */
export function SidebarNav({
  items = DEFAULT_NAV_ITEMS,
  pathname,
  className,
  brand = 'LyricLens',
}: {
  items?: NavItem[];
  pathname?: string | null;
  className?: string;
  brand?: string;
}) {
  const active = pathname ?? null;

  return (
    <nav
      aria-label="Primary"
      className={cn('hidden w-60 shrink-0 flex-col gap-1 p-4 lg:flex', className)}
    >
      <div className="mb-4 flex items-center gap-2.5 px-3">
        <span
          aria-hidden
          className="grid size-9 place-items-center rounded-md bg-accent text-accent-ink"
        >
          <Music className="size-5" />
        </span>
        <span className="text-lg font-extrabold tracking-tight text-text-high">{brand}</span>
      </div>

      <ul className="flex flex-col gap-1">
        {items.map((item) => {
          const activeLink = isActive(active, item.href);
          const Icon = item.icon;

          return (
            <li key={item.id}>
              <a
                href={item.href}
                aria-current={activeLink ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-3 rounded-pill px-3 py-2.5 text-sm font-semibold',
                  'transition-colors duration-150 ease-out',
                  'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
                  activeLink
                    ? 'bg-accent text-accent-ink'
                    : 'text-text-mid hover:bg-surface-glass hover:text-text-high',
                )}
              >
                <Icon aria-hidden className="size-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

/** Re-exported so consumers can type their own item lists. */
export type NavIcon = ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
