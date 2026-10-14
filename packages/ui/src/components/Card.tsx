import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

/**
 * The signature surface: 28px radius, soft elevation, optional glass. Every
 * elevated panel in the product (now-playing, library rows, lesson cards) is
 * this component with different padding.
 */
export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: 'solid' | 'glass' | 'outline';
  /** Use the 32px radius for hero-level panels. */
  radius?: 'card' | 'xl';
  /** Adds the lime glow used for the currently-active card. */
  highlighted?: boolean;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const PADDING = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
} as const;

const VARIANT = {
  solid: 'bg-surface border border-border-subtle shadow-card',
  glass: 'glass border border-border-subtle',
  outline: 'bg-transparent border border-border-strong',
} as const;

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { className, variant = 'solid', radius = 'card', highlighted = false, padding = 'md', ...props },
  ref,
) {
  return (
    <div
      ref={ref}
      className={cn(
        'relative overflow-hidden',
        radius === 'xl' ? 'rounded-xl' : 'rounded-card',
        VARIANT[variant],
        highlighted && 'shadow-glow-strong ring-1 ring-accent/45',
        PADDING[padding],
        className,
      )}
      {...props}
    />
  );
});
