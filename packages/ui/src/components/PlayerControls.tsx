import { Heart, Pause, Play, Repeat, Repeat1, Shuffle, SkipBack, SkipForward } from 'lucide-react';

import { cn } from '../lib/cn';

export interface PlayerControlsProps {
  playing: boolean;
  onTogglePlay: () => void;
  onPrevious?: () => void;
  onNext?: () => void;
  onShuffle?: () => void;
  repeatMode?: 'off' | 'all' | 'one';
  onCycleRepeat?: () => void;
  favorite?: boolean;
  onToggleFavorite?: () => void;
  disabled?: boolean;
  className?: string;
}

const SIDE_BUTTON =
  'grid size-11 place-items-center rounded-pill text-text-mid transition-colors duration-150 ease-out hover:bg-surface-glass hover:text-text-high focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:pointer-events-none disabled:opacity-40';

/**
 * Transport controls for the now-playing screen: the large round play/pause in
 * the middle of a ProgressRing, flanked by skip and the secondary toggles.
 *
 * Every control is a real `<button>` with an accessible name — icons alone are
 * never the only label.
 */
export function PlayerControls({
  playing,
  onTogglePlay,
  onPrevious,
  onNext,
  onShuffle,
  repeatMode = 'off',
  onCycleRepeat,
  favorite = false,
  onToggleFavorite,
  disabled = false,
  className,
}: PlayerControlsProps) {
  const RepeatIcon = repeatMode === 'one' ? Repeat1 : Repeat;

  return (
    <div className={cn('flex items-center justify-center gap-2 sm:gap-3', className)}>
      {onShuffle !== undefined && (
        <button
          type="button"
          onClick={onShuffle}
          disabled={disabled}
          aria-label="Shuffle"
          aria-pressed={false}
          className={SIDE_BUTTON}
        >
          <Shuffle aria-hidden className="size-5" />
        </button>
      )}

      {onPrevious !== undefined && (
        <button
          type="button"
          onClick={onPrevious}
          disabled={disabled}
          aria-label="Previous line"
          className={SIDE_BUTTON}
        >
          <SkipBack aria-hidden className="size-6" />
        </button>
      )}

      <button
        type="button"
        onClick={onTogglePlay}
        disabled={disabled}
        aria-label={playing ? 'Pause' : 'Play'}
        aria-pressed={playing}
        className={cn(
          'grid size-18 place-items-center rounded-pill',
          'bg-accent text-accent-ink shadow-glow hover:bg-accent-hover hover:shadow-glow-strong',
          'transition-[background-color,transform,box-shadow] duration-150 ease-out active:scale-95',
          'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
          'disabled:pointer-events-none disabled:opacity-40',
        )}
      >
        {playing ? (
          <Pause aria-hidden className="size-7 fill-current" />
        ) : (
          <Play aria-hidden className="size-7 translate-x-0.5 fill-current" />
        )}
      </button>

      {onNext !== undefined && (
        <button
          type="button"
          onClick={onNext}
          disabled={disabled}
          aria-label="Next line"
          className={SIDE_BUTTON}
        >
          <SkipForward aria-hidden className="size-6" />
        </button>
      )}

      {onCycleRepeat !== undefined && (
        <button
          type="button"
          onClick={onCycleRepeat}
          disabled={disabled}
          aria-label={`Repeat: ${repeatMode}`}
          className={cn(SIDE_BUTTON, repeatMode !== 'off' && 'text-accent-text')}
        >
          <RepeatIcon aria-hidden className="size-5" />
        </button>
      )}

      {onToggleFavorite !== undefined && (
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={disabled}
          aria-label={favorite ? 'Remove from favourites' : 'Add to favourites'}
          aria-pressed={favorite}
          className={cn(SIDE_BUTTON, favorite && 'text-danger')}
        >
          <Heart aria-hidden className={cn('size-5', favorite && 'fill-current')} />
        </button>
      )}
    </div>
  );
}
