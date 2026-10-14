import type { LyricLine, WordTiming } from './lyrics.js';

/**
 * Position -> lyric lookup. These are pure binary searches so the sync engine
 * can call them every animation frame without measurable cost.
 */

/**
 * Index of the line that should be highlighted at `positionMs`, or -1 when the
 * position falls before the first line.
 */
export function findLineIndexAt(lines: readonly LyricLine[], positionMs: number): number {
  if (lines.length === 0) return -1;

  let low = 0;
  let high = lines.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const line = lines[mid];
    if (line === undefined) break;
    if (line.startMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

/**
 * Index of the word highlighted at `positionMs`, or -1. Used by the karaoke
 * renderer; word timings are monotonic by construction.
 */
export function findWordIndexAt(words: readonly WordTiming[], positionMs: number): number {
  if (words.length === 0) return -1;

  let low = 0;
  let high = words.length - 1;
  let found = -1;

  while (low <= high) {
    const mid = (low + high) >>> 1;
    const word = words[mid];
    if (word === undefined) break;
    if (word.startMs <= positionMs) {
      found = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return found;
}

/**
 * Index of the next line after `fromIndex` that has visible text, skipping the
 * blank "instrumental" markers LRC files use. Returns -1 at the end.
 */
export function findNextSpeakableLine(lines: readonly LyricLine[], fromIndex: number): number {
  for (let i = fromIndex + 1; i < lines.length; i += 1) {
    const line = lines[i];
    if (line !== undefined && line.text.trim() !== '') return i;
  }
  return -1;
}

export function findPreviousSpeakableLine(lines: readonly LyricLine[], fromIndex: number): number {
  for (let i = fromIndex - 1; i >= 0; i -= 1) {
    const line = lines[i];
    if (line !== undefined && line.text.trim() !== '') return i;
  }
  return -1;
}

/** Fraction (0..1) through the document, clamped. Drives progress arcs. */
export function positionProgress(positionMs: number, durationMs: number | null): number {
  if (durationMs === null || durationMs <= 0) return 0;
  const ratio = positionMs / durationMs;
  if (Number.isNaN(ratio)) return 0;
  return Math.min(1, Math.max(0, ratio));
}
