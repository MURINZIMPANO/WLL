'use client';

import { PlayerControls, ProgressRing } from '@lyriclens/ui';
import { useEffect, useState } from 'react';

/**
 * Interactive now-playing demo.
 *
 * A Client Component because `PlayerControls` takes callbacks, and a Server
 * Component is not allowed to pass functions across the boundary. This is the
 * same constraint the real player will hit in Phase 1, so it is solved here
 * once, properly, instead of with a `'use client'` on the whole page.
 */

/**
 * A short excerpt used to demonstrate the lyric-sync presentation.
 *
 * Written for this demo rather than taken from a song: real lyrics come from
 * licensed providers at runtime under their own terms, and none are bundled in
 * the repository.
 */
const LINES = [
  'Say it back before the room goes quiet',
  'Every word lands exactly on time',
  'Nothing to install, nothing to configure',
  'Read along, then learn the words',
];

const LINE_MS = 2_600;

export function NowPlayingDemo() {
  const [playing, setPlaying] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('all');
  const [line, setLine] = useState(0);

  // Drives the highlighted line. Pause genuinely stops it, so the control is
  // not a decoration that only looks interactive.
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(() => {
      setLine((current) => (current + 1) % LINES.length);
    }, LINE_MS);
    return () => {
      clearInterval(id);
    };
  }, [playing]);

  const nextRepeat = (): void => {
    setRepeat((current) => (current === 'all' ? 'one' : current === 'one' ? 'off' : 'all'));
  };

  return (
    <div className="flex flex-col items-center gap-7">
      <ProgressRing value={0.42} size={190} label="Playback progress">
        <div className="grid place-items-center">
          <p className="text-2xl font-extrabold tracking-tight text-text-high">1:24</p>
          <p className="text-xs text-text-low">of 3:21</p>
        </div>
      </ProgressRing>

      {/*
        The lyric panel: the current line in lime, the neighbouring lines held
        back in secondary text. This is the thing the product exists to do, so
        it gets the loudest treatment in the panel rather than a progress ring
        on its own.
      */}
      <div className="w-full text-center" aria-live="off">
        <p className="text-xs font-bold tracking-wide text-text-low uppercase">Now singing</p>
        <ol className="mt-3 space-y-1.5">
          {LINES.map((text, index) => (
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
          setLine((current) => (current - 1 + LINES.length) % LINES.length);
        }}
        onNext={() => {
          setLine((current) => (current + 1) % LINES.length);
        }}
        onShuffle={() => undefined}
        onCycleRepeat={nextRepeat}
        repeatMode={repeat}
        favorite={favorite}
        onToggleFavorite={() => {
          setFavorite((value) => !value);
        }}
      />
    </div>
  );
}
