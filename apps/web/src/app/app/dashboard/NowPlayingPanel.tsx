'use client';

import { Badge, Button, PlayerControls, ProgressRing } from '@lyriclens/ui';
import { Music4 } from 'lucide-react';
import { useEffect, useState } from 'react';

import { DEMO_LYRIC_LINES, type TrackSummary } from '../demo-data';

const LINE_MS = 2_600;

/**
 * The now-playing panel.
 *
 * The highest-elevation surface on the dashboard — one level above the rails —
 * because it is the one thing the user is looking at while something plays.
 *
 * It shows the *current lyric line*, not a generic waveform: reading along is
 * the product, and a visualiser that says nothing about lyrics would be the
 * wrong thing to put in the largest panel on the page.
 */
export function NowPlayingPanel({ track }: { track: TrackSummary }) {
  const [playing, setPlaying] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('all');
  const [line, setLine] = useState(0);

  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setLine((current) => (current + 1) % DEMO_LYRIC_LINES.length);
    }, LINE_MS);
    return () => {
      clearInterval(id);
    };
  }, [playing]);

  return (
    <section
      aria-labelledby="now-playing-heading"
      className="relative overflow-hidden rounded-xl border border-border-subtle bg-surface p-6 shadow-elevated"
    >
      {/*
        Cover-derived glow. Real cover art arrives with the library API; until
        then the panel borrows the brand bloom so it still reads as the focal
        surface rather than another card.
      */}
      <div
        aria-hidden
        className="bloom pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-pill bg-accent/12 blur-3xl"
      />

      <div className="relative flex items-start justify-between gap-3">
        <h2
          id="now-playing-heading"
          className="text-xs font-bold tracking-wide text-text-low uppercase"
        >
          Now playing
        </h2>
        <Badge tone="accent">Demo</Badge>
      </div>

      <div className="relative mt-6 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="grid size-40 place-items-center overflow-hidden rounded-card border border-border-subtle bg-surface-2 app-gradient shadow-overlay">
            <Music4 aria-hidden className="size-10 text-text-low" />
          </div>
          {/* Playing indicator pinned to the artwork. */}
          <span
            aria-hidden
            className="absolute right-3 bottom-3 flex h-6 items-end gap-0.5 rounded-pill bg-bg-900/85 px-2 py-1.5 backdrop-blur-sm"
          >
            {[0, 1, 2].map((bar) => (
              <span
                key={bar}
                className="equalizer w-0.5 rounded-pill bg-accent"
                style={{
                  height: '0.85rem',
                  animationDelay: `${bar * 160}ms`,
                  animationPlayState: playing ? 'running' : 'paused',
                }}
              />
            ))}
          </span>
        </div>

        <div className="text-center">
          <p className="text-lg font-extrabold tracking-tight text-text-high">{track.title}</p>
          <p className="mt-1 text-sm text-text-low">{track.subtitle}</p>
        </div>

        <ProgressRing value={0.42} size={168} strokeWidth={5} label="Playback progress">
          <div className="grid place-items-center">
            <p className="text-xl font-extrabold tracking-tight text-text-high">1:24</p>
            <p className="text-xs text-text-low">of 3:21</p>
          </div>
        </ProgressRing>

        {/* The lyric sync itself: current line in lime, neighbours held back. */}
        <div className="w-full">
          <p className="text-center text-xs font-bold tracking-wide text-text-low uppercase">
            Lyrics
          </p>
          <ol className="mt-3 space-y-1.5 text-center">
            {DEMO_LYRIC_LINES.map((text, index) => (
              <li
                key={text}
                className={[
                  'truncate text-sm transition-[color,opacity,transform] duration-200 ease-out',
                  index === line ? 'scale-105 font-extrabold text-accent-text' : 'text-text-low',
                ].join(' ')}
              >
                {text}
              </li>
            ))}
          </ol>
        </div>

        <PlayerControls
          playing={playing}
          onTogglePlay={() => {
            setPlaying((value) => !value);
          }}
          onPrevious={() => {
            setLine((current) => (current - 1 + DEMO_LYRIC_LINES.length) % DEMO_LYRIC_LINES.length);
          }}
          onNext={() => {
            setLine((current) => (current + 1) % DEMO_LYRIC_LINES.length);
          }}
          onShuffle={() => undefined}
          onCycleRepeat={() => {
            setRepeat((current) => (current === 'all' ? 'one' : current === 'one' ? 'off' : 'all'));
          }}
          repeatMode={repeat}
          favorite={favorite}
          onToggleFavorite={() => {
            setFavorite((value) => !value);
          }}
        />
      </div>

      <div className="relative mt-6 flex justify-center">
        <Button variant="ghost" size="sm" disabled title="Opens the full player in Phase 1">
          Open full player
        </Button>
      </div>
    </section>
  );
}
