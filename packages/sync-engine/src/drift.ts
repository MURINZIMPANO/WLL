/**
 * Position interpolation and drift measurement.
 *
 * Media providers report position maybe once per second. Displaying that raw
 * value would step the highlight once a second, so the engine anchors a sample
 * to a monotonic clock and interpolates between anchors. The gap between what
 * we predicted and what the provider actually reported is the *drift*, and it
 * is the single number that tells us whether a source is healthy.
 */

/** A confirmed position reading pinned to a point on the monotonic clock. */
export interface Anchor {
  positionMs: number;
  monotonicMs: number;
  playing: boolean;
}

export const NO_ANCHOR: Anchor | null = null;

/** Predicted position at `nowMs`. Frozen while paused. */
export function interpolate(anchor: Anchor, nowMs: number): number {
  if (!anchor.playing) return anchor.positionMs;
  const elapsed = Math.max(0, nowMs - anchor.monotonicMs);
  return Math.max(0, anchor.positionMs + elapsed);
}

/**
 * Reported minus predicted. Positive means the provider is ahead of us (we are
 * behind and must jump forward); negative means we over-ran.
 */
export function measureDrift(anchor: Anchor, reportedPositionMs: number, nowMs: number): number {
  return reportedPositionMs - interpolate(anchor, nowMs);
}

export function shouldCorrect(driftMs: number, toleranceMs: number): boolean {
  return Math.abs(driftMs) > toleranceMs;
}

/**
 * Reject a sample that moved implausibly far in a short window. Deliberate seeks
 * are exempt — see {@link PositionSample.seeked}.
 */
export function isImplausibleStep(
  anchor: Anchor,
  reportedPositionMs: number,
  nowMs: number,
  maxStepMs: number,
): boolean {
  const allowed = maxStepMs + Math.max(0, nowMs - anchor.monotonicMs);
  return Math.abs(reportedPositionMs - anchor.positionMs) > allowed;
}

/** Structural sanity: a position outside the track is a provider bug, not a seek. */
export function isStructurallyValid(sample: {
  positionMs: number;
  durationMs: number | null;
}): boolean {
  if (!Number.isFinite(sample.positionMs) || sample.positionMs < 0) return false;
  if (sample.durationMs !== null && Number.isFinite(sample.durationMs)) {
    // Allow a small overshoot; players routinely report the final tick + epsilon.
    return sample.positionMs <= sample.durationMs + 5_000;
  }
  return true;
}
