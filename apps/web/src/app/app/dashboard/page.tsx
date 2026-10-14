import type { Metadata } from 'next';

import { DashboardScreen } from './DashboardScreen';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'Your synced lyrics, playlists and learning progress.',
};

export default function DashboardPage() {
  return <DashboardScreen />;
}
