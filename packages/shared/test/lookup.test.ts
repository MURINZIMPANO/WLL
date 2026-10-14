import { describe, expect, it } from 'vitest';

import { normalizeLyricsDoc } from '../src/lyrics.js';
import {
  findLineIndexAt,
  findNextSpeakableLine,
  findPreviousSpeakableLine,
  findWordIndexAt,
  positionProgress,
} from '../src/lookup.js';

function build(count: number, stepMs = 1_000) {
  return normalizeLyricsDoc({
    provider: 'test',
    lines: Array.from({ length: count }, (_, i) => ({ startMs: i * stepMs, text: `line ${i}` })),
  }).lines;
}

describe('findLineIndexAt', () => {
  const lines = build(5);

  it('returns the last line whose start is at or before the position', () => {
    expect(findLineIndexAt(lines, 0)).toBe(0);
    expect(findLineIndexAt(lines, 1_500)).toBe(1);
    expect(findLineIndexAt(lines, 4_999)).toBe(4);
  });

  it('clamps to the last line past the end', () => {
    expect(findLineIndexAt(lines, 99_000)).toBe(4);
  });

  it('returns -1 before the first line', () => {
    expect(findLineIndexAt(build(5, 1_000), 0)).toBe(0);
    const lateStart = normalizeLyricsDoc({
      provider: 't',
      lines: [{ startMs: 10_000, text: 'a' }],
    }).lines;
    expect(findLineIndexAt(lateStart, 0)).toBe(-1);
  });

  it('returns -1 for an empty document', () => {
    expect(findLineIndexAt([], 0)).toBe(-1);
  });

  it('agrees with a linear scan across a large document', () => {
    const big = build(2_000);
    for (const position of [0, 37, 1_000, 500_123, 1_999_999]) {
      const expected = big.findLastIndex((line) => line.startMs <= position);
      expect(findLineIndexAt(big, position)).toBe(expected);
    }
  });
});

describe('findWordIndexAt', () => {
  const words = [
    { word: 'a', startMs: 0, endMs: 500 },
    { word: 'b', startMs: 500, endMs: 1_000 },
    { word: 'c', startMs: 1_000, endMs: 1_500 },
  ];

  it('finds the active word', () => {
    expect(findWordIndexAt(words, 0)).toBe(0);
    expect(findWordIndexAt(words, 499)).toBe(0);
    expect(findWordIndexAt(words, 500)).toBe(1);
    expect(findWordIndexAt(words, 1_400)).toBe(2);
  });

  it('handles empty input', () => {
    expect(findWordIndexAt([], 0)).toBe(-1);
  });
});

describe('speakable-line navigation', () => {
  const lines = normalizeLyricsDoc({
    provider: 'test',
    lines: [
      { startMs: 0, text: 'first' },
      { startMs: 1_000, text: '' },
      { startMs: 2_000, text: 'third' },
    ],
  }).lines;

  it('skips blank instrumental lines going forward', () => {
    expect(findNextSpeakableLine(lines, 0)).toBe(2);
    expect(findNextSpeakableLine(lines, 2)).toBe(-1);
  });

  it('skips blank instrumental lines going backward', () => {
    expect(findPreviousSpeakableLine(lines, 2)).toBe(0);
    expect(findPreviousSpeakableLine(lines, 0)).toBe(-1);
  });
});

describe('positionProgress', () => {
  it('returns the clamped ratio', () => {
    expect(positionProgress(500, 1_000)).toBe(0.5);
    expect(positionProgress(-10, 1_000)).toBe(0);
    expect(positionProgress(5_000, 1_000)).toBe(1);
  });

  it('returns 0 without a usable duration', () => {
    expect(positionProgress(500, null)).toBe(0);
    expect(positionProgress(500, 0)).toBe(0);
  });
});
