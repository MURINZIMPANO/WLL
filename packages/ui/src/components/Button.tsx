import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { Loader2 } from 'lucide-react';
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

/**
 * Pill buttons, the primary action shape in the design language.
 *
 * `md` and up are at least 44px tall, which is the minimum comfortable touch
 * target — `sm` is for dense desktop chrome only.
 */
export const buttonVariants = cva(
  [
    'relative inline-flex items-center justify-center gap-2',
    'font-semibold whitespace-nowrap select-none',
    'rounded-pill',
    'transition-[background-color,color,box-shadow,transform] duration-150 ease-out',
    'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent',
    'disabled:pointer-events-none disabled:opacity-45',
    'active:scale-[0.98]',
  ],
  {
    variants: {
      variant: {
        primary:
          'bg-accent text-accent-ink hover:bg-accent-hover shadow-glow hover:shadow-glow-strong',
        secondary: 'glass text-text-high border border-border-subtle hover:bg-surface-glass-strong',
        ghost: 'text-text-mid hover:text-text-high hover:bg-surface-glass',
        outline: 'border border-border-strong text-text-high hover:bg-surface-glass',
        danger: 'bg-danger text-bg-900 hover:brightness-110',
      },
      size: {
        sm: 'h-9 px-4 text-sm',
        md: 'h-11 px-5 text-sm',
        lg: 'h-13 px-7 text-base',
        icon: 'size-11 p-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends
    Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'color'>,
    VariantProps<typeof buttonVariants> {
  /**
   * Render the styles onto the single child element instead of a `<button>` —
   * for links and router links. Radix `Slot` merges props onto exactly one
   * child, so when this is set the caller must supply exactly one element and
   * `leftIcon` / `rightIcon` are not rendered (put them inside the child).
   */
  asChild?: boolean;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    className,
    variant,
    size,
    asChild = false,
    loading = false,
    leftIcon,
    rightIcon,
    disabled,
    children,
    type,
    ...props
  },
  ref,
) {
  const classes = cn(buttonVariants({ variant, size }), className);

  if (asChild) {
    return (
      <Slot ref={ref} className={classes} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      // Default to "button" so a Button inside a form never submits by accident.
      type={type ?? 'button'}
      className={classes}
      disabled={disabled === true || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Loader2 aria-hidden className="size-4 shrink-0 animate-spin" /> : leftIcon}
      {children}
      {loading ? null : rightIcon}
    </button>
  );
});
