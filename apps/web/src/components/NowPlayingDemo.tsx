'use client';

import { PlayerControls, ProgressRing } from '@lyriclens/ui';
import { useState } from 'react';

/**
 * Interactive now-playing demo.
 *
 * A Client Component because `PlayerControls` takes callbacks, and a Server
 * Component is not allowed to pass functions across the boundary. This is the
 * same constraint the real player will hit in Phase 1, so it is solved here
 * once, properly, instead of with a `'use client'` on the whole page.
 */
export function NowPlayingDemo() {
  const [playing, setPlaying] = useState(true);
  const [favorite, setFavorite] = useState(false);
  const [repeat, setRepeat] = useState<'off' | 'all' | 'one'>('all');

  const nextRepeat = (): void => {
    setRepeat((current) => (current === 'off' ? 'all' : current === 'all' ? 'one' : 'off'));
  };

  return (
    <div className="flex flex-col items-center gap-6 py-4">
      <ProgressRing value={0.42} size={190} label="Playback progress">
        <div className="grid place-items-center">
          <p className="text-2xl font-extrabold tracking-tight text-text-high">1:24</p>
          <p className="text-xs text-text-low">of 3:21</p>
        </div>
      </ProgressRing>

      <PlayerControls
        playing={playing}
        onTogglePlay={() => {
          setPlaying((value) => !value);
        }}
        onPrevious={() => undefined}
        onNext={() => undefined}
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
