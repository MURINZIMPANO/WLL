import type { ReactNode } from 'react';

import { AppShell } from './AppShell';

/**
 * Layout for every signed-in screen.
 *
 * Navigation lives in the shell rather than in each page so the sidebar, the
 * mobile tab bar and the router-aware active state are defined once.
 */
export default function AppLayout({ children }: { children: ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
