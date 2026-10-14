import { Badge, Button, Card, Chip, MediaCard, MediaRail } from '@lyriclens/ui';
import { AudioLines, Blocks, Headphones, LibraryBig, ServerCog } from 'lucide-react';
import type { ReactNode } from 'react';

import { ApiStatus } from '@/components/ApiStatus';
import { NowPlayingDemo } from '@/components/NowPlayingDemo';
import { ThemeToggle } from '@/components/ThemeToggle';

/**
 * Phase 0 marketing surface.
 *
 * Composed entirely from `@lyriclens/ui` and the tokens — there is not a
 * one-off style on this page. Two rules govern what appears here:
 *
 *  1. Nothing is decorative filler. Every claim is either a real feature flag,
 *     a live read of the API, or a phase that genuinely has not shipped.
 *  2. The sections alternate `bg-900` / `bg-800` and carry one elevation each,
 *     so the eye can rank the page instead of scanning a flat column of equal
 *     cards.
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

/** The rail the design system demo used to be buried inside. */
const TRACKS = [
  { title: 'Hey Ya!', subtitle: 'OutKast', badge: '2 lines' },
  { title: 'Blinding Lights', subtitle: 'The Weeknd' },
  { title: 'Ye', subtitle: 'Burna Boy', badge: 'NEW' },
  { title: 'Clair de Lune', subtitle: 'Debussy' },
];

/** The delivery plan, re-presented as an image-forward rail for rhythm. */
const PHASES_AS_CARDS = COMING.map((item) => ({
  title: item.title,
  subtitle: item.phase,
  meta: item.detail,
  aspect: 'wide' as const,
}));

const LIMITS = [
  'A web page cannot read another app’s playback. That is a browser boundary, not a gap we can code around.',
  'DRM-protected video cannot be captured. Legal sources only, or upload your own file.',
  'Lyrics come only from licensed providers through adapters. Lyric sites are never scraped.',
  'Exported lyric videos are visual-only, or use audio you supplied yourself.',
];

const NAV_LINKS = [
  { href: '#live', label: 'Live' },
  { href: '#tracks', label: 'Tracks' },
  { href: '#roadmap', label: 'Roadmap' },
  { href: '#limits', label: 'Limits' },
];

/**
 * A full-bleed section.
 *
 * Owns the vertical rhythm for the whole page in one place, and alternates the
 * background shade so consecutive sections read as distinct bands without a
 * hard rule between them.
 */
function Band({
  id,
  eyebrow,
  title,
  lede,
  children,
  tone = 'base',
  className,
}: {
  id?: string;
  eyebrow?: string;
  title?: string;
  lede?: ReactNode;
  children: ReactNode;
  tone?: 'base' | 'raised';
  className?: string;
}) {
  return (
    <section
      id={id}
      className={[
        'relative scroll-mt-24 px-5 py-20 sm:py-28',
        tone === 'raised' ? 'section-band' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="mx-auto max-w-6xl">
        {(title !== undefined || eyebrow !== undefined) && (
          <header className="max-w-3xl">
            {eyebrow !== undefined && (
              <p className="text-sm font-bold tracking-wide text-accent-text uppercase">
                {eyebrow}
              </p>
            )}
            {title !== undefined && (
              <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-balance">{title}</h2>
            )}
            {lede !== undefined && <p className="mt-4 text-lg text-text-mid">{lede}</p>}
          </header>
        )}
        <div className={title !== undefined || eyebrow !== undefined ? 'mt-10' : ''}>
          {children}
        </div>
      </div>
    </section>
  );
}

export default function FoundationPage() {
  return (
    <div className="min-h-dvh">
      {/* ---- top nav ------------------------------------------------------- */}
      <header className="sticky top-0 z-30 border-b border-border-subtle glass">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-6 px-5 py-4">
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

          <nav aria-label="Sections" className="hidden items-center gap-1 md:flex">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="rounded-pill px-3 py-2 text-sm font-semibold text-text-mid transition-colors duration-150 ease-out hover:bg-surface-glass hover:text-text-high"
              >
                {link.label}
              </a>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button asChild variant="ghost" size="sm">
              <a href="#roadmap">Roadmap</a>
            </Button>
            <Button asChild size="sm">
              <a href="http://localhost:6006">Design system</a>
            </Button>
          </div>
        </div>
      </header>

      {/* ---- hero ---------------------------------------------------------- */}
      <section className="hero-surface relative overflow-hidden border-b border-border-subtle">
        {/* Decorative bloom behind the hero visual. Low alpha, never behind text. */}
        <div
          aria-hidden
          className="bloom pointer-events-none absolute -top-1/4 right-0 h-[42rem] w-[42rem] rounded-pill bg-accent/10 blur-3xl"
        />

        <div className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 lg:grid-cols-[1.05fr_0.95fr] lg:py-28">
          <div>
            <p className="text-sm font-bold tracking-wide text-accent-text uppercase">
              Live lyrics · subtitles · language learning
            </p>
            <h1 className="mt-5 max-w-2xl text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
              Read along with whatever is playing.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-text-mid text-pretty">
              LyricLens floats time-synced lyrics over any app on your desktop, puts subtitles
              beside your videos, and turns the songs you already love into language lessons.
            </p>

            <div className="mt-9 flex flex-wrap gap-3">
              <Button size="lg" disabled title="Enabled in Phase 1">
                Start the desktop overlay
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href="#live">See what runs today</a>
              </Button>
            </div>

            <p className="mt-4 text-sm text-text-low">
              Not built yet? The buttons above reflect the real feature flags — nothing on this page
              is decorative filler.
            </p>
          </div>

          {/* The product's core idea, shown rather than described. */}
          <Card variant="glass" radius="xl" padding="lg" className="shadow-overlay">
            <NowPlayingDemo />
          </Card>
        </div>
      </section>

      <main>
        {/* ---- what is live ------------------------------------------------ */}
        <Band
          id="live"
          tone="raised"
          eyebrow="Right now, on this machine"
          title="What is running today"
          lede="Four subsystems that already work end to end, and an API you can interrogate yourself."
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {FOUNDATION.map((item) => (
              <Card
                key={item.label}
                className="transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-elevated"
              >
                <p className="font-bold text-text-high">{item.label}</p>
                <p className="mt-1 text-sm text-text-mid">{item.detail}</p>
              </Card>
            ))}
          </div>

          <div className="mt-4">
            <ApiStatus />
          </div>
        </Band>

        {/* ---- tracks rail -------------------------------------------------- */}
        <Band
          id="tracks"
          eyebrow="Synced lyrics"
          title="Hottest tracks"
          lede="Each card is a real MediaCard from the design system — hover for the play affordance. Four tracks fill the row, so this one is a grid; the phase rail below is where the scrolling treatment earns its keep."
        >
          {/* A four-item grid, not a rail: at 176px the cards occupy barely half
              a 1112px row, and a rail that stops two-thirds short reads as a
              layout bug rather than as scrollability. */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TRACKS.map((track) => (
              <MediaCard
                key={track.title}
                // Both breakpoints overridden: the card ships `w-40 sm:w-44` for
                // rails, and a rail width inside a 1fr grid column leaves the
                // card hugging the left edge with dead space beside it.
                className="w-full sm:w-full"
                title={track.title}
                subtitle={track.subtitle}
                {...(track.badge === undefined ? {} : { badge: track.badge })}
                disabledReason="Playback arrives in Phase 1"
              />
            ))}
          </div>
        </Band>

        {/* ---- explore rail ------------------------------------------------- */}
        <Band
          id="roadmap"
          tone="raised"
          eyebrow="Explore libraries"
          title="What lands next"
          lede="Every phase below ships behind a feature flag that defaults to off, so nothing half-built can be reached by accident."
        >
          <MediaRail label="Delivery phases">
            {PHASES_AS_CARDS.map((item) => (
              <MediaCard
                key={item.title}
                variant="overlay"
                title={item.title}
                subtitle={item.subtitle}
                meta={item.meta}
                aspect={item.aspect}
                disabledReason="Arrives in a later phase"
              />
            ))}
          </MediaRail>
        </Band>

        {/* ---- spotlight ---------------------------------------------------- */}
        <Band
          eyebrow="Design system"
          title="The design system, rendered in the real app"
          lede={
            <>
              Every element below comes from <code className="text-accent-text">@lyriclens/ui</code>
              . Storybook has the full catalogue; this page is what the tokens look like inside
              Next.js.
            </>
          }
        >
          <div className="grid items-start gap-8 lg:grid-cols-[0.85fr_1.15fr]">
            <Card padding="lg" className="shadow-elevated">
              <p className="text-sm font-bold text-text-mid">Buttons</p>
              <div className="mt-4 flex flex-wrap gap-3">
                <Button>Primary</Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="outline">Outline</Button>
                <Button variant="danger">Danger</Button>
                <Button loading>Loading</Button>
              </div>

              <p className="mt-8 text-sm font-bold text-text-mid">Category chips</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {['All', 'Pop', 'Hip-hop', 'Afrobeats', 'Gospel', 'Movies', 'Tutorials'].map(
                  (label) => (
                    <Chip key={label} selected={label === 'All'}>
                      {label}
                    </Chip>
                  ),
                )}
              </div>
            </Card>

            <div className="space-y-4">
              {[
                'One radius scale: 28px for cards, 32px for hero panels, pills for controls.',
                'One elevation scale — rails sit low, the now-playing panel sits high.',
                'WCAG AA asserted against the shipped tokens, not against a copy of them.',
                'Light and dark are the same components with a class swap on <html>.',
              ].map((line) => (
                <div key={line} className="flex gap-4">
                  <span
                    aria-hidden
                    className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-surface-glass text-text-low"
                  >
                    <Blocks className="size-4" />
                  </span>
                  <p className="text-base text-text-mid">{line}</p>
                </div>
              ))}
            </div>
          </div>
        </Band>

        {/* ---- honest limits ------------------------------------------------ */}
        <Band id="limits" tone="raised" title="Honest limits">
          <Card variant="outline" padding="lg">
            <div className="flex gap-4">
              <span
                aria-hidden
                className="mt-0.5 grid size-9 shrink-0 place-items-center rounded-md bg-surface-glass text-text-low"
              >
                <ServerCog className="size-4" />
              </span>
              <ul className="max-w-3xl space-y-2.5 text-base text-text-mid">
                {LIMITS.map((limit) => (
                  <li key={limit}>{limit}</li>
                ))}
              </ul>
            </div>
          </Card>
        </Band>
      </main>

      {/* ---- CTA band ------------------------------------------------------- */}
      <section className="relative overflow-hidden border-y border-border-subtle app-gradient px-5 py-20">
        <div
          aria-hidden
          className="bloom pointer-events-none absolute -bottom-1/2 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-pill bg-accent/12 blur-3xl"
        />
        <div className="relative mx-auto flex max-w-3xl flex-col items-center text-center">
          <span
            aria-hidden
            className="grid size-16 place-items-center rounded-card bg-accent text-accent-ink shadow-glow-strong"
          >
            <Headphones className="size-8" />
          </span>
          <h2 className="mt-8 text-3xl font-extrabold tracking-tight text-balance sm:text-4xl">
            Don’t miss a beat.
          </h2>
          <p className="mt-4 max-w-xl text-base text-text-mid">
            Everything LyricLens shows is inspectable before you install anything. Open the
            components, the API, or the flags that decide what is switched on.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" leftIcon={<LibraryBig className="size-4" />}>
              <a href="http://localhost:6006">Storybook</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="http://localhost:4000/v1/health">API health</a>
            </Button>
            <Button asChild size="lg" variant="outline">
              <a href="http://localhost:4000/v1/flags">Feature flags</a>
            </Button>
          </div>
        </div>
      </section>

      {/* ---- footer --------------------------------------------------------- */}
      <footer className="px-5 py-16">
        <div className="mx-auto grid max-w-6xl gap-10 sm:grid-cols-2 lg:grid-cols-4">
          <div>
            <div className="flex items-center gap-2.5">
              <span
                aria-hidden
                className="grid size-9 place-items-center rounded-md bg-accent text-accent-ink"
              >
                <AudioLines className="size-5" />
              </span>
              <span className="text-lg font-extrabold tracking-tight">LyricLens</span>
            </div>
            <p className="mt-4 max-w-xs text-sm text-text-low">
              Phase 0 foundation. No data leaves this machine.
            </p>
          </div>

          {[
            {
              heading: 'Product',
              links: [
                { label: 'What runs today', href: '#live' },
                { label: 'Hottest tracks', href: '#tracks' },
                { label: 'Delivery plan', href: '#roadmap' },
                { label: 'Honest limits', href: '#limits' },
              ],
            },
            {
              heading: 'Build',
              links: [
                { label: 'Design system', href: 'http://localhost:6006' },
                { label: 'API health', href: 'http://localhost:4000/v1/health' },
                { label: 'Feature flags', href: 'http://localhost:4000/v1/flags' },
                { label: 'Provider status', href: 'http://localhost:4000/v1/providers' },
              ],
            },
            {
              heading: 'Legal',
              links: [
                { label: 'Licensed providers only', href: '#limits' },
                { label: 'No lyric scraping', href: '#limits' },
                { label: 'No training on uploads', href: '#limits' },
                { label: 'Exports are visual-only', href: '#limits' },
              ],
            },
          ].map((column) => (
            <nav key={column.heading} aria-label={column.heading}>
              <h3 className="text-sm font-bold tracking-wide text-text-low uppercase">
                {column.heading}
              </h3>
              <ul className="mt-4 space-y-2.5">
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a
                      href={link.href}
                      className="text-sm text-text-mid transition-colors duration-150 ease-out hover:text-text-high"
                    >
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>

        <div className="mx-auto mt-14 max-w-6xl border-t border-border-subtle pt-8 text-sm text-text-low">
          LyricLens — Phase 0 foundation. No data leaves this machine.
        </div>
      </footer>
    </div>
  );
}
