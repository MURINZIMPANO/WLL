import { Music4, Play } from 'lucide-react';
import { forwardRef } from 'react';

import { cn } from '../lib/cn';

export interface MediaCardProps {
  title: string;
  subtitle?: string | null;
  coverUrl?: string | null;
  /** Square art in the design language; `wide` is 16:9 for videos. */
  aspect?: 'square' | 'wide';
  className?: string;
  /** Extra text shown as a badge over the art, e.g. "NEW" or a duration. */
  badge?: string | null;
  /**
   * `caption` (default) puts the title under the art on a solid card — the
   * treatment for rails of songs. `overlay` sets the title on a gradient scrim
   * over the art, for the image-forward rail that gives a page visual rhythm.
   */
  variant?: 'caption' | 'overlay';
  /** Tertiary line under the subtitle, e.g. a track count. */
  meta?: string | null;
  /**
   * Supplied once real playback exists. Left out on a Phase 0 page the affordance
   * still renders, but disabled and labelled with *why*, rather than pretending
   * to be live.
   */
  onPlay?: () => void;
  /** Why the play affordance is inert, shown as the button's tooltip. */
  disabledReason?: string;
}

/**
 * One item in a horizontal card rail ("Popular", "New collection",
 * "Continue learning").
 *
 * The cover falls back to a branded placeholder rather than a broken image, and
 * the whole card is a single link target supplied by the parent via `asChild`
 * semantics — here we render an `<article>` and let the caller wrap it.
 *
 * Height contract: cards are `h-full` with the text block pinned to the bottom
 * by `mt-auto`, and the rail stretches its children. Without that a single
 * `aspect="wide"` card raises its title above every `aspect="square"` sibling
 * and the rail visibly staircases.
 */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(function MediaCard(
  {
    title,
    subtitle,
    coverUrl,
    aspect = 'square',
    className,
    badge,
    variant = 'caption',
    meta,
    onPlay,
    disabledReason,
  },
  ref,
) {
  const art = (
    <>
      {coverUrl != null && coverUrl !== '' ? (
        <img
          src={coverUrl}
          alt=""
          loading="lazy"
          decoding="async"
          className="size-full object-cover transition-transform duration-300 ease-out group-hover:scale-105"
        />
      ) : (
        <div className="grid size-full place-items-center app-gradient">
          <Music4
            aria-hidden
            className="size-8 text-text-low transition-colors duration-300 group-hover:text-accent-text"
          />
        </div>
      )}

      {badge != null && badge !== '' && (
        <span className="absolute top-2 left-2 rounded-pill bg-bg-900/80 px-2 py-0.5 text-xs font-semibold text-text-high backdrop-blur-sm">
          {badge}
        </span>
      )}

      <PlayButton onPlay={onPlay} disabledReason={disabledReason} />
    </>
  );

  const text = (
    <>
      <h3
        className={cn(
          'line-clamp-1 font-bold',
          variant === 'overlay'
            ? 'text-base text-text-high [text-shadow:0_1px_8px_rgb(0_0_0/0.55)]'
            : 'mt-2.5 text-sm text-text-high',
        )}
      >
        {title}
      </h3>
      {subtitle != null && subtitle !== '' && (
        <p
          className={cn(
            'line-clamp-1 text-xs text-text-low',
            variant === 'overlay' && '[text-shadow:0_1px_8px_rgb(0_0_0/0.55)]',
          )}
        >
          {subtitle}
        </p>
      )}
      {meta != null && meta !== '' && (
        <p
          className={cn(
            'text-xs text-text-low',
            variant === 'overlay'
              ? 'line-clamp-2 leading-snug [text-shadow:0_1px_8px_rgb(0_0_0/0.55)]'
              : 'line-clamp-1',
          )}
        >
          {meta}
        </p>
      )}
    </>
  );

  if (variant === 'overlay') {
    return (
      <article
        ref={ref}
        className={cn(
          'group relative w-72 shrink-0 overflow-hidden rounded-card border border-border-subtle bg-surface-2 shadow-card',
          'transition-[transform,box-shadow] duration-200 ease-out',
          'hover:-translate-y-1 hover:shadow-elevated',
          className,
        )}
      >
        {/*
          The text lives *inside* the art container so `overflow-hidden` on the
          card clips it. Absolutely positioning it against the article instead
          let a three-line label spill past the artwork on a 16:9 card.
        */}
        <div className={cn('relative', aspect === 'wide' ? 'aspect-4/3' : 'aspect-square')}>
          {art}
          {/* Scrim: label text sits over artwork, so it needs a guaranteed
              backdrop rather than relying on the art being dark. */}
          <div aria-hidden className="scrim-bottom absolute inset-0" />
          <div className="absolute inset-x-0 bottom-0 p-4">{text}</div>
        </div>
      </article>
    );
  }

  return (
    <article
      ref={ref}
      className={cn(
        'group flex h-full w-40 shrink-0 flex-col sm:w-44',
        'rounded-card border border-border-subtle bg-surface p-2 shadow-card',
        'transition-[transform,box-shadow] duration-200 ease-out',
        'hover:-translate-y-1 hover:shadow-elevated',
        'focus-within:-translate-y-1 focus-within:shadow-elevated',
        className,
      )}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-md bg-surface-2',
          aspect === 'square' ? 'aspect-square' : 'aspect-video',
        )}
      >
        {art}
      </div>

      {/* `mt-auto` pins the text to the bottom so mixed aspects stay level. */}
      <div className="mt-auto pt-2.5">{text}</div>
    </article>
  );
});

/**
 * The hover play affordance.
 *
 * Hidden until hover or keyboard focus — it is decorative until Phase 1 wires
 * real playback — and never removed from the accessibility tree, so it can
 * never become an unreachable control for a keyboard or screen-reader user.
 */
function PlayButton({
  onPlay,
  disabledReason,
}: {
  onPlay?: (() => void) | undefined;
  disabledReason?: string | undefined;
}) {
  const label = onPlay === undefined ? `Play ${disabledReason ?? ''}`.trim() : `Play`;

  return (
    <button
      type="button"
      onClick={onPlay}
      disabled={onPlay === undefined}
      title={onPlay === undefined ? disabledReason : undefined}
      aria-label={label}
      className={cn(
        'absolute inset-0 m-auto grid size-11 place-items-center rounded-pill',
        'bg-accent text-accent-ink shadow-overlay',
        'opacity-0 transition-[opacity,transform] duration-200 ease-out',
        'group-hover:opacity-100 group-focus-within:opacity-100 hover:scale-105',
        'focus-visible:opacity-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
        'disabled:cursor-not-allowed',
      )}
    >
      <Play aria-hidden className="size-5 translate-x-0.5 fill-current" />
    </button>
  );
}

/** The scrolling rail wrapper. */
export function MediaRail({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="scroll-rail items-stretch" role="list" aria-label={label}>
      {children}
    </div>
  );
}
