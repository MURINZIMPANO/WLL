import { describe, expect, it } from 'vitest';

import {
  interpolate,
  isImplausibleStep,
  isStructurallyValid,
  measureDrift,
  shouldCorrect,
  type Anchor,
} from '../src/drift.js';

const anchor = (positionMs: number, monotonicMs: number, playing = true): Anchor => ({
  positionMs,
  monotonicMs,
  playing,
});

describe('interpolate', () => {
  it('advances with elapsed time while playing', () => {
    expect(interpolate(anchor(1_000, 10_000), 10_500)).toBe(1_500);
  });

  it('is frozen while paused', () => {
    expect(interpolate(anchor(1_000, 10_000, false), 20_000)).toBe(1_000);
  });

  it('never goes backwards if the clock is read out of order', () => {
    expect(interpolate(anchor(1_000, 10_000), 9_000)).toBe(1_000);
  });

  it('never returns a negative position', () => {
    expect(interpolate(anchor(-5_000, 0), 1_000)).toBe(0);
  });
});

describe('measureDrift', () => {
  it('is positive when the provider is ahead of our prediction', () => {
    expect(measureDrift(anchor(1_000, 0), 1_800, 500)).toBe(300);
  });

  it('is negative when we over-ran', () => {
    expect(measureDrift(anchor(1_000, 0), 900, 500)).toBe(-600);
  });

  it('is zero for a perfectly predicted sample', () => {
    expect(measureDrift(anchor(1_000, 0), 1_500, 500)).toBe(0);
  });
});

describe('shouldCorrect', () => {
  it('triggers above the tolerance and not below', () => {
    expect(shouldCorrect(121, 120)).toBe(true);
    expect(shouldCorrect(-121, 120)).toBe(true);
    expect(shouldCorrect(120, 120)).toBe(false);
    expect(shouldCorrect(0, 120)).toBe(false);
  });
});

describe('isImplausibleStep', () => {
  it('rejects a jump far beyond what elapsed time allows', () => {
    expect(isImplausibleStep(anchor(1_000, 0), 90_000, 1_000, 5_000)).toBe(true);
  });

  it('accepts a jump consistent with elapsed time', () => {
    expect(isImplausibleStep(anchor(1_000, 0), 2_000, 1_000, 5_000)).toBe(false);
  });

  it('grants more headroom the longer since the anchor', () => {
    expect(isImplausibleStep(anchor(1_000, 0), 12_000, 10_000, 5_000)).toBe(false);
  });
});

describe('isStructurallyValid', () => {
  it('accepts a normal position', () => {
    expect(isStructurallyValid({ positionMs: 1_000, durationMs: 200_000 })).toBe(true);
  });

  it('rejects negative and non-finite positions', () => {
    expect(isStructurallyValid({ positionMs: -1, durationMs: null })).toBe(false);
    expect(isStructurallyValid({ positionMs: Number.NaN, durationMs: null })).toBe(false);
    expect(isStructurallyValid({ positionMs: Number.POSITIVE_INFINITY, durationMs: null })).toBe(
      false,
    );
  });

  it('rejects a position well past the duration', () => {
    expect(isStructurallyValid({ positionMs: 400_000, durationMs: 200_000 })).toBe(false);
  });

  it('tolerates a small overshoot at the end of a track', () => {
    expect(isStructurallyValid({ positionMs: 202_000, durationMs: 200_000 })).toBe(true);
  });

  it('accepts any position when the duration is unknown', () => {
    expect(isStructurallyValid({ positionMs: 9_999_999, durationMs: null })).toBe(true);
  });
});
