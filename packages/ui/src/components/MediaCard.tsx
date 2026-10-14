import { Music4 } from 'lucide-react';
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
}

/**
 * One item in a horizontal card rail ("Popular", "New collection",
 * "Continue learning").
 *
 * The cover falls back to a branded placeholder rather than a broken image, and
 * the whole card is a single link target supplied by the parent via `asChild`
 * semantics — here we render an `<article>` and let the caller wrap it.
 */
export const MediaCard = forwardRef<HTMLDivElement, MediaCardProps>(function MediaCard(
  { title, subtitle, coverUrl, aspect = 'square', className, badge },
  ref,
) {
  return (
    <article
      ref={ref}
      className={cn(
        'group w-40 shrink-0 sm:w-44',
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
            <Music4 aria-hidden className="size-8 text-text-low" />
          </div>
        )}

        {badge != null && badge !== '' && (
          <span className="absolute top-2 left-2 rounded-pill bg-bg-900/80 px-2 py-0.5 text-xs font-semibold text-text-high backdrop-blur-sm">
            {badge}
          </span>
        )}
      </div>

      <h3 className="mt-2.5 line-clamp-1 text-sm font-bold text-text-high">{title}</h3>
      {subtitle != null && subtitle !== '' && (
        <p className="mt-0.5 line-clamp-1 text-xs text-text-low">{subtitle}</p>
      )}
    </article>
  );
});

/** The scrolling rail wrapper. */
export function MediaRail({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="scroll-rail" role="list" aria-label={label}>
      {children}
    </div>
  );
}
