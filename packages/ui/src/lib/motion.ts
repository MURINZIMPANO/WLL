import type { Transition, Variants } from 'framer-motion';

/**
 * Shared motion language: 150-300ms ease-out, spring for sheets.
 * Every value is expressed so that `prefers-reduced-motion` can neutralise it
 * (see `useReducedMotion` usage in Sheet / Toast / PlayerControls).
 */

export const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** The spring used by sheets and anything that should feel physical. */
export const SPRING: Transition = {
  type: 'spring',
  stiffness: 420,
  damping: 34,
  mass: 0.9,
};

export const DURATIONS = {
  fast: 0.15,
  base: 0.22,
  slow: 0.3,
} as const;

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: DURATIONS.base, ease: EASE_OUT } },
};

export const riseIn: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATIONS.base, ease: EASE_OUT } },
};

/** Staggered container for card rails and lists. */
export const staggerParent: Variants = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.05, delayChildren: 0.04 } },
};

export const staggerChild: Variants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { duration: DURATIONS.base, ease: EASE_OUT } },
};

/** Collapses every variant to an instant, invisible-free state change. */
export function reducedVariants(variants: Variants): Variants {
  const collapsed: Variants = {};
  for (const key of Object.keys(variants)) {
    const value = variants[key];
    collapsed[key] =
      typeof value === 'object' && value !== null && 'y' in value
        ? { opacity: (value as { opacity?: number }).opacity ?? 1, y: 0 }
        : { opacity: (value as { opacity?: number } | undefined)?.opacity ?? 1 };
  }
  return collapsed;
}
