import { cn } from '../lib/cn';

export interface ProgressRingProps {
  /** 0..1. Values outside the range are clamped. */
  value: number;
  size?: number;
  strokeWidth?: number;
  /** Accessible label, e.g. "Playback progress". */
  label: string;
  /** Rendered in the middle of the ring — typically the play/pause button. */
  children?: React.ReactNode;
  className?: string;
  showValue?: boolean;
}

/**
 * Circular arc progress for the now-playing screen.
 *
 * Built on a single SVG circle with `stroke-dasharray`, so it animates on the
 * compositor without triggering layout, and exposes `role="progressbar"` with a
 * live `aria-valuenow`.
 */
export function ProgressRing({
  value,
  size = 280,
  strokeWidth = 6,
  label,
  children,
  className,
  showValue = false,
}: ProgressRingProps) {
  const clamped = Number.isFinite(value) ? Math.min(1, Math.max(0, value)) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - clamped);

  return (
    <div
      className={cn('relative inline-grid place-items-center', className)}
      style={{ width: size, height: size }}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(clamped * 100)}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-surface-glass-strong"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="stroke-accent transition-[stroke-dashoffset] duration-150 ease-out"
        />
      </svg>

      <div className="absolute inset-0 grid place-items-center">
        {children ??
          (showValue ? (
            <span className="text-sm font-semibold text-text-mid">
              {Math.round(clamped * 100)}%
            </span>
          ) : null)}
      </div>
    </div>
  );
}
