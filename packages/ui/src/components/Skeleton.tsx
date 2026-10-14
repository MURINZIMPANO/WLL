import { cn } from '../lib/cn';

/**
 * Loading placeholder.
 *
 * The shimmer is suppressed under `prefers-reduced-motion` (handled globally in
 * globals.css) and the element is hidden from assistive tech — a screen reader
 * should hear the real status text, not six empty boxes.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      aria-hidden
      className={cn('animate-pulse rounded-md bg-surface-glass-strong', className)}
      {...props}
    />
  );
}

/** A card-shaped skeleton matching the library / dashboard rails. */
export function MediaCardSkeleton({ className }: { className?: string }) {
  return (
    <div className={cn('w-44 shrink-0 space-y-3', className)}>
      <Skeleton className="aspect-square w-full rounded-card" />
      <Skeleton className="h-3.5 w-4/5" />
      <Skeleton className="h-3 w-3/5" />
    </div>
  );
}
