import type { Meta, StoryObj } from '@storybook/react-vite';
import { useState } from 'react';

import { MobileTabBar, SidebarNav } from '../components/AppNav';
import { Badge } from '../components/Badge';
import { Card } from '../components/Card';
import { Input } from '../components/Input';
import { MediaCard, MediaRail } from '../components/MediaCard';
import { MediaCardSkeleton, Skeleton } from '../components/Skeleton';
import { PlayerControls } from '../components/PlayerControls';
import { ProgressRing } from '../components/ProgressRing';

const surfaces = {
  title: 'Foundations/Surfaces',
  tags: ['autodocs'],
} satisfies Meta;

export default surfaces;
type Story = StoryObj<typeof surfaces>;

export const Cards: Story = {
  render: () => (
    <div className="grid max-w-4xl gap-4 sm:grid-cols-3">
      <Card>
        <p className="font-bold text-text-high">Solid</p>
        <p className="mt-1 text-sm text-text-mid">Default card surface.</p>
      </Card>
      <Card variant="glass">
        <p className="font-bold text-text-high">Glass</p>
        <p className="mt-1 text-sm text-text-mid">Blurred, for overlays.</p>
      </Card>
      <Card variant="outline">
        <p className="font-bold text-text-high">Outline</p>
        <p className="mt-1 text-sm text-text-mid">For secondary panels.</p>
      </Card>
      <Card highlighted className="sm:col-span-3">
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-text-high">Highlighted</p>
            <p className="mt-1 text-sm text-text-mid">Lime glow, used for the active item.</p>
          </div>
          <Badge tone="accent">Now playing</Badge>
        </div>
      </Card>
    </div>
  ),
};

export const Inputs: Story = {
  render: () => (
    <div className="max-w-md space-y-4">
      <Input label="Song or artist" placeholder="Search LRCLIB" />
      <Input label="Offset adjustment" hint="Positive delays the highlight." defaultValue="120" />
      <Input label="Title" error="A title is required" defaultValue="" />
    </div>
  ),
};

export const Badges: Story = {
  render: () => (
    <div className="flex flex-wrap gap-2">
      <Badge>Neutral</Badge>
      <Badge tone="accent">Accent</Badge>
      <Badge tone="success">Synced</Badge>
      <Badge tone="warning">Untimed</Badge>
      <Badge tone="danger">Failed</Badge>
    </div>
  ),
};

export const CardRail: Story = {
  render: () => (
    <div className="space-y-10">
      <section>
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Caption cards</h2>
        <p className="mb-3 text-sm text-text-low">
          The default treatment for a rail of songs. Titles sit on the card, pinned to the bottom,
          so a mixed run of square and wide art stays level.
        </p>
        <MediaRail label="Continue listening">
          <MediaCard title="Hey Ya!" subtitle="OutKast" coverUrl={null} />
          <MediaCard
            title="Blinding Lights"
            subtitle="The Weeknd"
            coverUrl="https://picsum.photos/seed/lyriclens/300/300"
          />
          <MediaCard title="Ye" subtitle="Burna Boy" badge="NEW" />
          <MediaCard
            title="Clair de Lune"
            subtitle="Debussy"
            aspect="wide"
            coverUrl="https://picsum.photos/seed/lyriclens/400/225"
          />
          <MediaCard
            title="Redbone"
            subtitle="Childish Gambino"
            coverUrl="https://picsum.photos/seed/lyriclens2/300/300"
          />
        </MediaRail>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Overlay cards</h2>
        <p className="mb-3 text-sm text-text-low">
          Image-forward, with the label on a gradient scrim. Use this treatment for a different kind
          of collection so two rails on one page do not read identically.
        </p>
        <MediaRail label="Delivery phases">
          <MediaCard
            variant="overlay"
            title="Music MVP"
            subtitle="Phase 1"
            meta="Desktop overlay, Spotify Connect, Identify song, LRCLIB lyrics"
            aspect="wide"
          />
          <MediaCard
            variant="overlay"
            title="PWA shell"
            subtitle="Phase 2"
            meta="Manifest, service worker, offline, install prompt"
            aspect="wide"
            coverUrl="https://picsum.photos/seed/lyriclens3/600/450"
          />
          <MediaCard
            variant="overlay"
            title="Video mode"
            subtitle="Phase 3"
            meta="Upload, Whisper transcription, synced subtitles"
            aspect="wide"
          />
        </MediaRail>
      </section>

      <section>
        <h2 className="mb-1 text-lg font-extrabold tracking-tight">Play affordance</h2>
        <p className="mb-3 text-sm text-text-low">
          Hover or focus a card. The affordance stays disabled — and says why — until real playback
          lands in Phase 1.
        </p>
        <div className="grid max-w-md grid-cols-2 gap-4">
          <MediaCard
            className="w-full sm:w-full"
            title="Inactive"
            subtitle="No handler supplied"
            disabledReason="Playback arrives in Phase 1"
          />
          <MediaCard
            className="w-full sm:w-full"
            title="Playable"
            subtitle="Handler supplied"
            onPlay={() => undefined}
          />
        </div>
      </section>
    </div>
  ),
};

export const Skeletons: Story = {
  render: () => (
    <div className="space-y-6">
      <div className="max-w-sm space-y-2">
        <Skeleton className="h-8 w-full" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-2/5" />
      </div>
      <MediaRail label="Loading">
        <MediaCardSkeleton />
        <MediaCardSkeleton />
        <MediaCardSkeleton />
      </MediaRail>
    </div>
  ),
};

/** Extracted to a component so the hook is legal — a story `render` is not one. */
function PlayerDemo() {
  const [playing, setPlaying] = useState(true);
  return (
    <div className="flex max-w-md flex-col items-center gap-8">
      <div className="relative">
        <div aria-hidden className="absolute inset-0 -z-10 rounded-full bg-accent/20 blur-3xl" />
        <ProgressRing value={0.42} size={240} label="Playback progress">
          <div className="grid place-items-center">
            <p className="text-3xl font-extrabold tracking-tight text-text-high">1:24</p>
            <p className="text-xs text-text-low">of 3:21</p>
          </div>
        </ProgressRing>
      </div>

      <PlayerControls
        playing={playing}
        onTogglePlay={() => {
          setPlaying((value) => !value);
        }}
        onPrevious={() => undefined}
        onNext={() => undefined}
        onShuffle={() => undefined}
        onCycleRepeat={() => undefined}
        repeatMode="all"
        onToggleFavorite={() => undefined}
      />
    </div>
  );
}

export const Player: Story = {
  render: () => <PlayerDemo />,
};

export const Navigation: Story = {
  render: () => (
    <div className="grid gap-8 lg:grid-cols-[16rem_1fr]">
      <div className="min-h-96 rounded-card border border-border-subtle bg-bg-800">
        <SidebarNav pathname="/app/library" />
      </div>

      <div className="min-h-96 rounded-card border border-border-subtle bg-bg-800">
        <SidebarNav pathname="/app/dashboard" user={{ name: 'Demo Listener', initials: 'DL' }} />
      </div>

      <div className="relative min-h-80 rounded-card border border-border-subtle bg-bg-800">
        <p className="p-6 text-sm text-text-mid">
          The floating pill tab bar renders at the bottom of the viewport on mobile, and hides from{' '}
          <code className="text-accent-text">lg</code> up where the sidebar takes over.
        </p>
        <MobileTabBar pathname="/app/library" />
      </div>
    </div>
  ),
};
