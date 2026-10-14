import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef, type HTMLAttributes } from 'react';

import { cn } from '../lib/cn';

export const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-pill px-2.5 py-0.5 font-semibold text-xs whitespace-nowrap',
  {
    variants: {
      tone: {
        neutral: 'bg-surface-glass text-text-mid',
        accent: 'bg-accent-soft text-accent-text',
        success: 'bg-success-soft text-success',
        danger: 'bg-danger-soft text-danger',
        warning: 'bg-warning-soft text-warning',
      },
    },
    defaultVariants: { tone: 'neutral' },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>, VariantProps<typeof badgeVariants> {}

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(function Badge(
  { className, tone, ...props },
  ref,
) {
  return <span ref={ref} className={cn(badgeVariants({ tone }), className)} {...props} />;
});
