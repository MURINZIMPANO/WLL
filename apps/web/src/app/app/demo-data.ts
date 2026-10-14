import type { LucideIcon } from 'lucide-react';
import { Compass, GraduationCap, Home, Library, Settings } from 'lucide-react';

/**
 * Placeholder content for the Phase 0 dashboard.
 *
 * There is no account system until Phase 4 and no library API until Phase 4, so
 * every value here is a literal. It is kept in one file, clearly named, and
 * labelled in the UI so nobody mistakes it for real data — the alternative,
 * faking a signed-in user with real-looking history, would be worse.
 *
 * `lyriclensPhase` is the phase that replaces each collection with live data.
 */

export const DEMO_USER = {
  name: 'Demo Listener',
  initials: 'DL',
  /** Rendered next to the name so the placeholder state is never ambiguous. */
  isDemo: true,
} as const;

export interface TrackSummary {
  id: string;
  title: string;
  subtitle: string;
  /** Lyric-sync state this card reports. */
  status: 'Synced' | 'Instrumental' | 'Needs sync';
  /** Position in the transcript, e.g. "3 / 42 lines". */
  position?: string;
}

export const RECENTLY_PLAYED: TrackSummary[] = [
  { id: 't1', title: 'Hey Ya!', subtitle: 'OutKast', status: 'Synced', position: '12 / 31' },
  {
    id: 't2',
    title: 'Blinding Lights',
    subtitle: 'The Weeknd',
    status: 'Synced',
    position: '48 / 64',
  },
  { id: 't3', title: 'Ye', subtitle: 'Burna Boy', status: 'Needs sync', position: '2 / 40' },
  { id: 't4', title: 'Clair de Lune', subtitle: 'Debussy', status: 'Instrumental' },
  {
    id: 't5',
    title: 'Supermassive Black Hole',
    subtitle: 'Muse',
    status: 'Synced',
    position: '19 / 55',
  },
  {
    id: 't6',
    title: 'Redbone',
    subtitle: 'Childish Gambino',
    status: 'Synced',
    position: '7 / 38',
  },
];

export interface PlaylistSummary {
  id: string;
  title: string;
  trackCount: number;
  /** Learning progress, shown as a progress bar on the tile. */
  learned: number;
}

/**
 * Tiles are tinted with the product's own accent at low alpha rather than
 * arbitrary brand colours — the brief asks for colour derived from artwork, and
 * until artwork exists the honest substitute is the brand hue.
 */
export const PLAYLISTS: PlaylistSummary[] = [
  { id: 'p1', title: 'Spanish for beginners', trackCount: 42, learned: 0.18 },
  { id: 'p2', title: 'Slow tempo study', trackCount: 18, learned: 0.52 },
  { id: 'p3', title: 'Karaoke night', trackCount: 27, learned: 0.34 },
  { id: 'p4', title: 'Focus, no lyrics', trackCount: 61, learned: 0.09 },
  { id: 'p5', title: 'Pronunciation drills', trackCount: 12, learned: 0.71 },
  { id: 'p6', title: 'Saved for later', trackCount: 95, learned: 0.03 },
];

export interface HistoryEntry {
  id: string;
  title: string;
  subtitle: string;
  chip: { label: string; tone: 'accent' | 'success' | 'warning' | 'neutral' };
  /** Played on, relative to now. */
  when: string;
}

export const HISTORY: HistoryEntry[] = [
  {
    id: 'h1',
    title: 'Bublí',
    subtitle: 'Duki',
    chip: { label: 'Synced', tone: 'success' },
    when: '12 min',
  },
  {
    id: 'h2',
    title: 'Until I Found You',
    subtitle: 'Stephen Sanchez',
    chip: { label: '92% learned', tone: 'accent' },
    when: '1 hr',
  },
  {
    id: 'h3',
    title: 'Ordinary',
    subtitle: 'Alex Warren',
    chip: { label: 'Synced', tone: 'success' },
    when: 'Yesterday',
  },
  {
    id: 'h4',
    title: 'Espresso',
    subtitle: 'Sabrina Carpenter',
    chip: { label: 'Review due', tone: 'warning' },
    when: 'Yesterday',
  },
  {
    id: 'h5',
    title: 'Golden',
    subtitle: 'Harry Styles',
    chip: { label: 'Synced', tone: 'success' },
    when: 'Mon',
  },
];

/** The lines shown in the now-playing lyric panel. Written for the demo. */
export const DEMO_LYRIC_LINES = [
  'Say it back before the room goes quiet',
  'Every word lands exactly on time',
  'Nothing to install, nothing to configure',
  'Read along, then learn the words',
];

export interface NavEntry {
  id: string;
  label: string;
  href: string;
  icon: LucideIcon;
}

/**
 * Dashboard navigation.
 *
 * Only Home exists yet — Library, Learn and Explore are Phase 4. They are
 * listed so the sidebar reads as a real shell, and each says so when followed.
 */
export const DASHBOARD_NAV: NavEntry[] = [
  { id: 'home', label: 'Home', href: '/app/dashboard', icon: Home },
  { id: 'library', label: 'Library', href: '/app/library', icon: Library },
  { id: 'learn', label: 'Learn', href: '/app/learn', icon: GraduationCap },
  { id: 'explore', label: 'Explore', href: '/app/explore', icon: Compass },
  { id: 'settings', label: 'Settings', href: '/app/settings', icon: Settings },
];
