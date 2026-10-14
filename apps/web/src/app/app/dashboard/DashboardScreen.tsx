'use client';

import { Badge, Button, Card, Input, MediaCard, MediaRail } from '@lyriclens/ui';
import { Bell, LibraryBig, Music4, Pause, Play, Search } from 'lucide-react';
import { useState } from 'react';

import { NowPlayingPanel } from './NowPlayingPanel';
import { DEMO_USER, HISTORY, PLAYLISTS, RECENTLY_PLAYED, type HistoryEntry } from '../demo-data';

/**
 * Phase 0 dashboard shell.
 *
 * Layout follows the reference: fixed sidebar, header row, a "recently played"
 * rail, a playlist grid, a higher-elevation now-playing panel, and a dense
 * history list.
 *
 * Every row of content is placeholder data from `../demo-data`, labelled as
 * such on screen. Accounts and the library land in Phase 4; building the layout
 * now means that phase swaps data in rather than redesigning a screen.
 *
 * One elevation rule, applied consistently: rails and grids sit on
 * `shadow-card`; the now-playing panel sits on `shadow-elevated`. That is what
 * tells the eye which surface is primary.
 */
export function DashboardScreen() {
  const [playingId, setPlayingId] = useState<string | null>(RECENTLY_PLAYED[0]?.id ?? null);
  const nowPlaying = RECENTLY_PLAYED.find((track) => track.id === playingId);

  const today = new Intl.DateTimeFormat(undefined, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());

  return (
    <div className="mx-auto grid max-w-[110rem] gap-8 px-5 py-8 lg:px-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      {/* ---- main column ---------------------------------------------------- */}
      <div className="min-w-0 space-y-12">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Good day, {DEMO_USER.name.split(' ')[0]}
            </h1>
            <p className="mt-1 text-sm text-text-low">{today}</p>
          </div>

          <div className="flex w-full items-center gap-3 sm:w-auto">
            <div className="min-w-0 flex-1 sm:w-80">
              <Input
                icon={<Search className="size-4" />}
                placeholder="Search songs, artists, lyrics"
                aria-label="Search songs, artists and lyrics"
              />
            </div>
            <Button size="icon" variant="ghost" aria-label="Notifications" disabled>
              <Bell className="size-5" />
            </Button>
          </div>
        </header>

        <p className="-mt-8 flex items-center gap-2 text-sm text-text-low">
          <Badge tone="warning">Demo data</Badge>
          Accounts and the library arrive in Phase 4. Nothing here is real.
        </p>

        {/* ---- recently played --------------------------------------------- */}
        <section aria-labelledby="recent-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="recent-heading" className="text-xl font-extrabold tracking-tight">
              Recently played
            </h2>
            <Button variant="ghost" size="sm" disabled title="Library arrives in Phase 4">
              See all
            </Button>
          </div>

          <div className="mt-5">
            <MediaRail label="Recently played">
              {RECENTLY_PLAYED.map((track) => (
                <MediaCard
                  key={track.id}
                  title={track.title}
                  subtitle={track.subtitle}
                  badge={track.status === 'Synced' ? null : track.status}
                  meta={track.position ?? null}
                  disabledReason="Playback arrives in Phase 1"
                />
              ))}
            </MediaRail>
          </div>
        </section>

        {/* ---- playlists ---------------------------------------------------- */}
        <section aria-labelledby="library-heading">
          <div className="flex items-end justify-between gap-4">
            <h2 id="library-heading" className="text-xl font-extrabold tracking-tight">
              Your playlists
            </h2>
            <Button variant="ghost" size="sm" disabled title="Playlists arrive in Phase 4">
              See all
            </Button>
          </div>

          <ul className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {PLAYLISTS.map((playlist) => (
              <li key={playlist.id}>
                <Card
                  padding="none"
                  className="group h-full transition-[transform,box-shadow] duration-200 ease-out hover:-translate-y-0.5 hover:shadow-elevated"
                >
                  <div className="relative grid aspect-video place-items-center overflow-hidden bg-surface-2 app-gradient">
                    <LibraryBig aria-hidden className="size-8 text-text-low" />
                    <span
                      aria-hidden
                      className="scrim-bottom absolute inset-0 opacity-0 transition-opacity duration-200 group-hover:opacity-100"
                    />
                  </div>

                  <div className="p-4">
                    <p className="font-bold text-text-high">{playlist.title}</p>
                    <p className="mt-0.5 text-sm text-text-low">{playlist.trackCount} tracks</p>

                    <div className="mt-4 flex items-center gap-3">
                      {/* A bar, not an arc: at tile scale a 28px ring has no room
                          for a label inside it and the digits collide with the
                          stroke. */}
                      <div
                        role="progressbar"
                        aria-label={`${playlist.title} learned`}
                        aria-valuemin={0}
                        aria-valuemax={100}
                        aria-valuenow={Math.round(playlist.learned * 100)}
                        className="h-1.5 flex-1 overflow-hidden rounded-pill bg-surface-glass-strong"
                      >
                        <div
                          className="h-full rounded-pill bg-accent"
                          style={{ width: `${Math.round(playlist.learned * 100)}%` }}
                        />
                      </div>
                      <span className="w-16 shrink-0 text-right text-xs font-semibold text-text-low">
                        {Math.round(playlist.learned * 100)}%
                      </span>
                    </div>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        </section>

        {/* ---- history ------------------------------------------------------ */}
        <section aria-labelledby="history-heading">
          <h2 id="history-heading" className="text-xl font-extrabold tracking-tight">
            Listen again
          </h2>

          <ul className="mt-5 divide-y divide-border-subtle overflow-hidden rounded-card border border-border-subtle bg-surface">
            {HISTORY.map((entry) => (
              <HistoryRow
                key={entry.id}
                entry={entry}
                playing={playingId === entry.id}
                onToggle={() => {
                  setPlayingId((current) => (current === entry.id ? null : entry.id));
                }}
              />
            ))}
          </ul>
        </section>
      </div>

      {/* ---- now playing ----------------------------------------------------- */}
      <aside className="min-w-0">
        <div className="xl:sticky xl:top-8">
          {nowPlaying !== undefined && <NowPlayingPanel track={nowPlaying} />}
        </div>
      </aside>
    </div>
  );
}

/**
 * One dense history row: thumbnail, title, status chip, timestamp, play/pause.
 *
 * The chip is the row's status readout, so it sits before the timestamp rather
 * than after it — status is read first, recency second.
 */
function HistoryRow({
  entry,
  playing,
  onToggle,
}: {
  entry: HistoryEntry;
  playing: boolean;
  onToggle: () => void;
}) {
  return (
    <li className="flex items-center gap-4 p-3 transition-colors duration-150 ease-out hover:bg-surface-glass">
      <span
        aria-hidden
        className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-md bg-surface-2 app-gradient"
      >
        <Music4 className="size-4 text-text-low" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-bold text-text-high">{entry.title}</p>
        <p className="truncate text-xs text-text-low">{entry.subtitle}</p>
      </div>

      <Badge tone={entry.chip.tone}>{entry.chip.label}</Badge>

      <span className="hidden w-20 shrink-0 text-right text-xs text-text-low sm:block">
        {entry.when}
      </span>

      <Button
        size="icon"
        variant="ghost"
        onClick={onToggle}
        aria-label={`${playing ? 'Pause' : 'Play'} ${entry.title}`}
      >
        {playing ? (
          <Pause aria-hidden className="size-4 fill-current" />
        ) : (
          <Play aria-hidden className="size-4 translate-x-0.5 fill-current" />
        )}
      </Button>
    </li>
  );
}
