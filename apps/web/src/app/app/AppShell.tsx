'use client';

import { MobileTabBar, SidebarNav } from '@lyriclens/ui';
import { usePathname } from 'next/navigation';
import type { ReactNode } from 'react';

import { DASHBOARD_NAV, DEMO_USER } from './demo-data';

/**
 * The signed-in shell.
 *
 * A Client Component purely because the active nav item comes from the router.
 * `SidebarNav` and `MobileTabBar` are deliberately router-agnostic — they take
 * `pathname` as a prop — so the same pair also serves the Tauri shell, which
 * runs on Vite and has no Next router. Keeping the routing here is what
 * preserves that.
 */
export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="flex min-h-dvh">
      <div className="sticky top-0 h-dvh">
        <SidebarNav
          items={DASHBOARD_NAV}
          pathname={pathname}
          user={{ name: DEMO_USER.name, initials: DEMO_USER.initials }}
        />
      </div>

      {/* Bottom padding clears the floating tab bar on mobile. */}
      <div className="min-w-0 flex-1 pb-28 lg:pb-0">{children}</div>

      <MobileTabBar items={DASHBOARD_NAV} pathname={pathname} />
    </div>
  );
}
