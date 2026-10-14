import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type ButtonHTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * Horizontal category chips (All / Pop / Hip-hop / Movies / Tutorials …).
 * The active chip is filled with the brand lime, per the design reference.
 *
 * Rendered as a real button so keyboard users get the expected behaviour, with
 * `role="tablist"` supplied by the caller when the chips drive a panel.
 */
export const chipVariants = cva(
  [
    'inline-flex items-center gap-2 whitespace-nowrap select-none',
    'rounded-pill border font-semibold',
    'transition-colors duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-45',
  ],
  {
    variants: {
      selected: {
        true: 'bg-accent text-accent-ink border-accent shadow-glow',
        false:
          'bg-surface-glass text-text-mid border-border-subtle hover:text-text-high hover:border-border-strong',
      },
      size: {
        sm: 'h-8 px-3.5 text-xs',
        md: 'h-10 px-4 text-sm',
      },
    },
    defaultVariants: { selected: false, size: 'md' },
  },
);

export interface ChipProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color' | 'aria-selected' | 'aria-pressed'>,
    VariantProps<typeof chipVariants> {}

export const Chip = forwardRef<HTMLButtonElement, ChipProps>(function Chip(
  { className, selected = false, size, type, ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type ?? 'button'}
      // `selected` is `boolean | null | undefined` (cva allows null); React's
      // aria-pressed does not accept null under exactOptionalPropertyTypes.
      aria-pressed={selected ?? false}
      className={cn(chipVariants({ selected, size }), className)}
      {...props}
    />
  );
});
