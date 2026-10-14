import { z } from 'zod';

import { formatLrcTimestamp, parseClockTimestamp } from './time.js';

/** A single word with its own timing, used for karaoke-style highlighting. */
export const WordTimingSchema = z.object({
  word: z.string(),
  startMs: z.number().int().nonnegative(),
  endMs: z.number().int().nonnegative(),
});
export type WordTiming = z.infer<typeof WordTimingSchema>;

export const LyricLineSchema = z.object({
  index: z.number().int().nonnegative(),
  startMs: z.number().int().nonnegative(),
  /** Exclusive end; `null` on the final line (runs to the end of the track). */
  endMs: z.number().int().nonnegative().nullable(),
  text: z.string(),
  words: z.array(WordTimingSchema),
});
export type LyricLine = z.infer<typeof LyricLineSchema>;

export const LyricsDocSchema = z.object({
  provider: z.string(),
  /** False when we only have flat, untimed text — the UI must offer "add timings". */
  synced: z.boolean(),
  lines: z.array(LyricLineSchema),
  /** Per-user nudge applied at playback time, never baked into `startMs`. */
  offsetMs: z.number().int(),
  metadata: z.record(z.string(), z.string()),
});
export type LyricsDoc = z.infer<typeof LyricsDocSchema>;

export interface LrcDiagnostic {
  /** 1-based line number in the source text. */
  line: number;
  reason: string;
  raw: string;
}

export interface LrcParseResult {
  doc: LyricsDoc;
  diagnostics: LrcDiagnostic[];
}

export interface ParseLrcOptions {
  provider?: string;
  /** How long the final line is assumed to run, in ms. Only affects `endMs`. */
  tailDurationMs?: number;
}

const METADATA_KEYS = new Set([
  'ar',
  'ti',
  'al',
  'au',
  'by',
  'length',
  'offset',
  're',
  've',
  'tool',
]);

const LEADING_TIMESTAMP = /^\[(\d{1,3}:\d{1,2}(?::\d{1,2})?(?:[.,]\d{1,3})?)\]/;

/**
 * Parse an LRC file.
 *
 * Tolerates the real-world variations: several timestamps sharing one line,
 * `[mm:ss]` without fractions, `[hh:mm:ss.xxx]`, blank "instrumental" lines,
 * and arbitrary junk between entries (reported as diagnostics, never thrown).
 *
 * The `[offset:±ms]` tag is applied at parse time (effective = tag - offset, per
 * the LRC convention) and the per-user playback nudge stays on `doc.offsetMs`.
 * Keeping the two apart is what makes the offset adjuster reversible.
 */
export function parseLrc(input: string, options: ParseLrcOptions = {}): LrcParseResult {
  const provider = options.provider ?? 'unknown';
  const tailDurationMs = options.tailDurationMs ?? 4000;

  const diagnostics: LrcDiagnostic[] = [];
  const metadata: Record<string, string> = {};
  const staged: Array<{ startMs: number; text: string }> = [];
  let rawOffsetMs = 0;

  const sourceLines = input.replace(/^\uFEFF/, '').split(/\r?\n/);

  for (let i = 0; i < sourceLines.length; i += 1) {
    const raw = sourceLines[i] ?? '';
    const lineNumber = i + 1;
    const trimmed = raw.trim();
    if (trimmed === '') continue;

    const timestamps: number[] = [];
    let cursor = raw;

    // Consume every leading `[mm:ss.xx]` tag on this line.
    for (;;) {
      const match = LEADING_TIMESTAMP.exec(cursor);
      if (match === null) break;
      const parsed = match[1] === undefined ? null : parseClockTimestamp(match[1]);
      if (parsed === null) {
        diagnostics.push({ line: lineNumber, reason: 'Unparseable timestamp', raw });
        break;
      }
      timestamps.push(parsed);
      cursor = cursor.slice(match[0].length);
    }

    if (timestamps.length > 0) {
      const text = cursor.replace(/\s+$/, '');
      for (const startMs of timestamps) staged.push({ startMs: Math.max(0, startMs), text });
      continue;
    }

    const meta = /^\[([a-zA-Z]+):(.*)\]$/.exec(trimmed);
    if (meta !== null) {
      const key = (meta[1] ?? '').toLowerCase();
      const value = (meta[2] ?? '').trim();
      if (key === 'offset') {
        const parsedOffset = Number.parseInt(value, 10);
        if (Number.isFinite(parsedOffset)) rawOffsetMs = parsedOffset;
        else diagnostics.push({ line: lineNumber, reason: 'Non-numeric offset tag', raw });
      } else if (METADATA_KEYS.has(key)) {
        metadata[key] = value;
      }
      continue;
    }

    diagnostics.push({ line: lineNumber, reason: 'Line is neither a timestamp nor a tag', raw });
  }

  // Effective time per the LRC offset convention: positive offset shifts up.
  const adjusted = staged
    .map((entry) => ({ ...entry, startMs: Math.max(0, entry.startMs - rawOffsetMs) }))
    .sort((a, b) => a.startMs - b.startMs);

  const deduped: typeof adjusted = [];
  for (const entry of adjusted) {
    const previous = deduped[deduped.length - 1];
    if (
      previous !== undefined &&
      previous.startMs === entry.startMs &&
      previous.text === entry.text
    ) {
      continue;
    }
    deduped.push(entry);
  }

  const lines: LyricLine[] = deduped.map((entry, index) => {
    const next = deduped[index + 1];
    // The final line has no successor, so its end is "until the track ends"
    // (`null`). We still need a concrete span to spread its word timings over.
    const endMs = next === undefined ? null : Math.max(entry.startMs, next.startMs);
    const spanEndMs = endMs ?? entry.startMs + tailDurationMs;
    return {
      index,
      startMs: entry.startMs,
      endMs,
      text: entry.text,
      words: deriveWordTimings(entry.text, entry.startMs, spanEndMs),
    };
  });

  if (rawOffsetMs !== 0) metadata['offset'] = String(rawOffsetMs);

  return {
    doc: {
      provider,
      synced: lines.length > 0,
      lines,
      offsetMs: 0,
      metadata,
    },
    diagnostics,
  };
}

/**
 * Spread word timings evenly across the line. Real per-word alignment arrives
 * from WhisperX in Phase 3; until then this gives karaoke highlighting that is
 * monotonic and never overshoots the line.
 */
function deriveWordTimings(text: string, startMs: number, endMs: number): WordTiming[] {
  const words = splitWords(text);
  if (words.length === 0) return [];

  const span = Math.max(0, endMs - startMs);
  const perWord = Math.floor(span / words.length);

  return words.map((word, i) => ({
    word,
    startMs: startMs + i * perWord,
    endMs: i === words.length - 1 ? endMs : startMs + (i + 1) * perWord,
  }));
}

/**
 * Split text into display words, keeping trailing punctuation attached so that
 * rendering never loses a comma or apostrophe. Handles languages that do not
 * put spaces between words (Chinese, Japanese, Thai) by falling back to a
 * per-character split for CJK runs.
 */
export function splitWords(text: string): string[] {
  const trimmed = text.trim();
  if (trimmed === '') return [];

  const tokens: string[] = [];
  for (const chunk of trimmed.split(/\s+/)) {
    if (chunk === '') continue;
    tokens.push(...splitCjkAware(chunk));
  }
  return tokens;
}

const CJK = /[\u3040-\u30ff\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff\uac00-\ud7af]/;

function splitCjkAware(chunk: string): string[] {
  if (!CJK.test(chunk)) return [chunk];

  const out: string[] = [];
  let buffer = '';
  for (const char of chunk) {
    if (CJK.test(char)) {
      if (buffer !== '') {
        out.push(buffer);
        buffer = '';
      }
      out.push(char);
    } else {
      buffer += char;
    }
  }
  if (buffer !== '') out.push(buffer);
  return out;
}

/** Serialise back to LRC. Round-trips `parseLrc(toLrc(doc))` for synced docs. */
export function toLrc(doc: LyricsDoc, options: { fractionDigits?: 2 | 3 } = {}): string {
  const fractionDigits = options.fractionDigits ?? 2;
  const out: string[] = ['[re:LyricLens]'];

  const title = doc.metadata['ti'];
  const artist = doc.metadata['ar'];
  const album = doc.metadata['al'];
  const by = doc.metadata['by'];
  if (title !== undefined) out.push(`[ti:${title}]`);
  if (artist !== undefined) out.push(`[ar:${artist}]`);
  if (album !== undefined) out.push(`[al:${album}]`);
  if (by !== undefined) out.push(`[by:${by}]`);

  for (const line of doc.lines) {
    out.push(`${formatLrcTimestamp(line.startMs, fractionDigits)}${line.text}`);
  }

  return `${out.join('\n')}\n`;
}

/** Flat text export — one line per lyric, no timings. */
export function lyricsToPlainText(doc: LyricsDoc): string {
  return `${doc.lines.map((line) => line.text).join('\n')}\n`;
}

/** Build a validated, normalised doc from provider output. */
export function normalizeLyricsDoc(input: {
  provider: string;
  lines: Array<{ startMs: number; text: string; endMs?: number | null }>;
  metadata?: Record<string, string>;
  offsetMs?: number;
  tailDurationMs?: number;
}): LyricsDoc {
  const tailDurationMs = input.tailDurationMs ?? 4000;
  const sorted = [...input.lines].sort((a, b) => a.startMs - b.startMs);

  const lines: LyricLine[] = sorted.map((entry, index) => {
    const next = sorted[index + 1];
    const startMs = Math.max(0, Math.round(entry.startMs));
    const endMs =
      entry.endMs !== undefined && entry.endMs !== null
        ? Math.max(startMs, Math.round(entry.endMs))
        : next !== undefined
          ? Math.max(startMs, next.startMs)
          : null;
    const spanEndMs = endMs ?? startMs + tailDurationMs;

    return {
      index,
      startMs,
      endMs,
      text: entry.text,
      words: deriveWordTimings(entry.text, startMs, spanEndMs),
    };
  });

  return LyricsDocSchema.parse({
    provider: input.provider,
    synced: lines.length > 0,
    lines,
    offsetMs: input.offsetMs ?? 0,
    metadata: input.metadata ?? {},
  });
}

/** Untimed text -> a valid, non-synced doc (the "no lyrics yet" fallback path). */
export function plainTextToLyricsDoc(text: string, provider = 'manual'): LyricsDoc {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+$/, ''))
    .filter((line) => line.trim() !== '')
    .map((lineText, index) => ({
      index,
      startMs: 0,
      endMs: null,
      text: lineText,
      words: [],
    }));

  return {
    provider,
    synced: false,
    lines,
    offsetMs: 0,
    metadata: {},
  };
}
