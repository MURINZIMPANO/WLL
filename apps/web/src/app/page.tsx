import { Badge, Button, Card, Chip, MediaCard, MediaRail } from '@lyriclens/ui';
import { AudioLines, Blocks, LibraryBig, ServerCog } from 'lucide-react';

import { ApiStatus } from '@/components/ApiStatus';
import { NowPlayingDemo } from '@/components/NowPlayingDemo';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Phase 0 foundation page.
 *
 * Not the final marketing site — that is Phase 2. Its job here is to prove the
 * design system renders end to end inside Next.js: tokens, light/dark, the
 * component set, and a live read of the API. Everything below is built from
 * `@lyriclens/ui`; there is not a single one-off style on this page.
 */

const FOUNDATION = [
  { label: 'Monorepo + tooling', detail: 'pnpm workspaces, turbo, ESLint, Prettier, Vitest' },
  { label: 'Design system', detail: 'Tokens, 13 components, Storybook, WCAG AA verified' },
  { label: 'Sync engine', detail: 'idle → detecting → fetching → synced → error, <300 ms drift' },
  { label: 'API + database', detail: 'Fastify, SQLite via libSQL, local queue, encrypted storage' },
];

const COMING = [
  {
    phase: 'Phase 1',
    title: 'Music MVP',
    detail: 'Desktop overlay, Spotify Connect, Identify song, LRCLIB lyrics',
  },
  {
    phase: 'Phase 2',
    title: 'PWA shell',
    detail: 'Manifest, service worker, offline, install prompt',
  },
  {
    phase: 'Phase 3',
    title: 'Video mode',
    detail: 'Upload, Whisper transcription, synced subtitles',
  },
  {
    phase: 'Phase 4',
    title: 'Accounts & library',
    detail: 'Auth, saved sessions, playlists, offline replay',
  },
  {
    phase: 'Phase 5',
    title: 'Scene player & export',
    detail: 'Karaoke backgrounds, LRC/SRT/PNG/MP4 export',
  },
  {
    phase: 'Phase 6',
    title: 'Learn',
    detail: 'Translation, vocabulary, spaced repetition, exercises',
  },
  {
    phase: 'Phase 7',
    title: 'Pronunciation',
    detail: 'TTS, A-B loop, shadowing, per-word scoring',
  },
  {
    phase: 'Phase 8',
    title: 'Polish',
    detail: 'Push reminders, a11y audit, installers, Lighthouse targets',
  },
];

export default function FoundationPage() {
  return (
    <div className="min-h-dvh">
      <header className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <div className="flex items-center gap-2.5">
          <span
            aria-hidden
            className="grid size-9 place-items-center rounded-md bg-accent text-accent-ink shadow-glow"
          >
            <AudioLines className="size-5" />
          </span>
          <span className="text-lg font-extrabold tracking-tight">LyricLens</span>
          <Badge tone="accent">Phase 0</Badge>
        </div>
        <ThemeToggle />
      </header>

      {/* ---- hero ---------------------------------------------------------- */}
      <section className="hero-surface relative overflow-hidden border-y border-border-subtle">
        <div className="mx-auto max-w-6xl px-5 py-16 sm:py-24">
          <p className="text-sm font-bold tracking-wide text-accent-text uppercase">
            Live lyrics · subtitles · language learning
          </p>
          <h1 className="mt-4 max-w-3xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Read along with whatever is playing.
          </h1>
          <p className="mt-5 max-w-2xl text-base text-text-mid text-pretty">
            LyricLens floats time-synced lyrics over any app on your desktop, puts subtitles beside
            your videos, and turns the songs you already love into language lessons.
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Button size="lg" disabled title="Enabled in Phase 1">
              Start the desktop overlay
            </Button>
            <Button asChild size="lg" variant="secondary">
              <a href="http://localhost:6006">Open the design system</a>
            </Button>
          </div>

          <p className="mt-4 text-sm text-text-low">
            Not built yet? The buttons above reflect the real feature flags — nothing on this page
            is decorative filler.
          </p>
        </div>
      </section>

      <main className="mx-auto max-w-6xl space-y-16 px-5 py-16">
        {/* ---- what is live ------------------------------------------------ */}
        <section aria-labelledby="foundation-heading">
          <h2 id="foundation-heading" className="text-xl font-extrabold tracking-tight">
            What is running right now
          </h2>

          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {FOUNDATION.map((item) => (
              <Card key={item.label}>
                <p className="font-bold text-text-high">{item.label}</p>
                <p className="mt-1 text-sm text-text-mid">{item.detail}</p>
              </Card>
            ))}
          </div>

          <div className="mt-4">
            <ApiStatus />
          </div>
        </section>

        {/* ---- design system proof ---------------------------------------- */}
        <section aria-labelledby="design-heading">
          <h2 id="design-heading" className="text-xl font-extrabold tracking-tight">
            The design system, rendered in the real app
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-text-mid">
            Every element below comes from <code className="text-accent-text">@lyriclens/ui</code>.
            Storybook has the full catalogue; this page is what the tokens look like inside Next.js.
          </p>

          <Card className="mt-6 space-y-8">
            <div className="space-y-3">
              <p className="text-sm font-bold text-text-mid">Buttons</p>
              <div className="flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger">Danger</Button>
                <Button loading>Loading</Button>
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-text-mid">Category chips</p>
              <div className="flex flex-wrap gap-2">
                {['All', 'Pop', 'Hip-hop', 'Afrobeats', 'Gospel', 'Movies', 'Tutorials'].map(
                  (label) => (
                    <Chip key={label} selected={label === 'All'}>
                      {label}
                    </Chip>
                  ),
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-text-mid">Now playing</p>
              <NowPlayingDemo />
            </div>

            <div className="space-y-3">
              <p className="text-sm font-bold text-text-mid">Card rail</p>
              <MediaRail label="Continue listening">
                <MediaCard title="Hey Ya!" subtitle="OutKast" badge="2 lines" />
                <MediaCard title="Blinding Lights" subtitle="The Weeknd" />
                <MediaCard title="Ye" subtitle="Burna Boy" badge="NEW" />
                <MediaCard title="Clair de Lune" subtitle="Debussy" aspect="wide" />
              </MediaRail>
            </div>
          </Card>
        </section>

        {/* ---- roadmap ----------------------------------------------------- */}
        <section aria-labelledby="roadmap-heading">
          <h2 id="roadmap-heading" className="text-xl font-extrabold tracking-tight">
            Delivery plan
          </h2>
          <p className="mt-2 max-w-2xl text-sm text-text-mid">
            Every phase below ships behind a feature flag that defaults to off, so nothing
            half-built can be reached by accident.
          </p>

          <ul className="mt-6 grid gap-3 sm:grid-cols-2">
            {COMING.map((item) => (
              <li key={item.phase}>
                <Card variant="outline" className="flex h-full gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-surface-glass text-text-low"
                  >
                    <Blocks className="size-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="text-xs font-bold tracking-wide text-text-low uppercase">
                      {item.phase}
                    </p>
                    <p className="mt-0.5 font-bold text-text-high">{item.title}</p>
                    <p className="mt-1 text-sm text-text-mid">{item.detail}</p>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- honesty ----------------------------------------------------- */}
        <section aria-labelledby="limits-heading">
          <Card variant="outline" className="flex gap-4">
            <span
              aria-hidden
              className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-surface-glass text-text-low"
            >
              <ServerCog className="size-4" />
            </span>
            <div>
              <h2 id="limits-heading" className="font-bold text-text-high">
                Honest limits
              </h2>
              <ul className="mt-2 space-y-1.5 text-sm text-text-mid">
                <li>
                  A web page cannot read another app&apos;s playback. That is a browser boundary,
                  not a gap we can code around.
                </li>
                <li>
                  DRM-protected video cannot be captured. Legal sources only, or upload your own
                  file.
                </li>
                <li>
                  Lyrics come only from licensed providers through adapters. Lyric sites are never
                  scraped.
                </li>
                <li>Exported lyric videos are visual-only, or use audio you supplied yourself.</li>
              </ul>
            </div>
          </Card>

          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <a href="http://localhost:6006">
                <LibraryBig aria-hidden className="size-4" />
                Storybook
              </a>
            </Button>
            <Button asChild variant="outline">
              <a href="http://localhost:4000/v1/health">API health</a>
            </Button>
            <Button asChild variant="outline">
              <a href="http://localhost:4000/v1/flags">Feature flags</a>
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-border-subtle">
        <div className="mx-auto max-w-6xl px-5 py-8 text-sm text-text-low">
          LyricLens — Phase 0 foundation. No data leaves this machine.
        </div>
      </footer>
    </div>
  );
}
