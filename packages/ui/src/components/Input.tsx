import { forwardRef, useId, type InputHTMLAttributes, type ReactNode } from 'react';

import { cn } from '../lib/cn';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  /** Validation message; switches the field to the error tone when present. */
  error?: string;
  hint?: string;
  /** Icon rendered inside the field on the left. */
  icon?: ReactNode;
  /** Trailing element (e.g. a clear button). */
  trailing?: ReactNode;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { className, label, error, hint, icon, trailing, id, ...props },
  ref,
) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const describedBy = error ? `${inputId}-error` : hint ? `${inputId}-hint` : undefined;

  return (
    <div className="flex w-full flex-col gap-1.5">
      {label !== undefined && (
        <label htmlFor={inputId} className="text-sm font-semibold text-text-mid">
          {label}
        </label>
      )}

      <div
        className={cn(
          'flex items-center gap-2 rounded-pill border bg-surface-glass px-4',
          'transition-colors duration-150 ease-out',
          'focus-within:border-accent focus-within:shadow-glow',
          error !== undefined && 'border-danger focus-within:border-danger',
          className,
        )}
      >
        {icon !== undefined && (
          <span aria-hidden className="shrink-0 text-text-low">
            {icon}
          </span>
        )}

        <input
          ref={ref}
          id={inputId}
          aria-invalid={error !== undefined || undefined}
          aria-describedby={describedBy}
          className={cn(
            'h-11 w-full min-w-0 bg-transparent text-base text-text-high',
            'placeholder:text-text-low',
            'focus:outline-none disabled:cursor-not-allowed disabled:opacity-50',
          )}
          {...props}
        />

        {trailing !== undefined && <span className="shrink-0">{trailing}</span>}
      </div>

      {error !== undefined ? (
        <p id={`${inputId}-error`} role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : hint !== undefined ? (
        <p id={`${inputId}-hint`} className="text-sm text-text-low">
          {hint}
        </p>
      ) : null}
    </div>
  );
});
