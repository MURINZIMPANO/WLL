import { formatSrtTimestamp, formatVttTimestamp, parseClockTimestamp } from './time.js';
import type { LyricLine } from './lyrics.js';
import { LyricsDocSchema, type LyricsDoc } from './lyrics.js';

/**
 * SubRip (`.srt`) and WebVTT (`.vtt`) codecs.
 *
 * Both formats are the same data with different punctuation, so they share one
 * cue parser. The result is normalised into a {@link LyricsDoc} — the overlay,
 * the web player and the exporter all consume one shape regardless of whether
 * the source was a song, a movie or a Whisper transcript.
 */

export type SubtitleFormat = 'srt' | 'vtt';

export interface SubtitleParseResult {
  doc: LyricsDoc;
  /** Cue indices that could not be parsed, for observability. */
  diagnostics: Array<{ index: number; reason: string; raw: string }>;
}

const CUE_TIMING = /^(\S+)\s+-->\s+(\S+)(?:\s+.*)?$/;

export function parseSubtitles(input: string, format: SubtitleFormat): SubtitleParseResult {
  const diagnostics: SubtitleParseResult['diagnostics'] = [];
  const normalised = input.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');

  // Drop the WEBVTT signature and any header/NOTE/STYLE/REGION blocks.
  const body = normalised
    .split('\n')
    .filter((line) => !/^WEBVTT/.test(line))
    .join('\n');

  const blocks = body.split(/\n{2,}/);
  const lines: LyricLine[] = [];

  for (const block of blocks) {
    const rawLines = block.split('\n').filter((line) => line.trim() !== '');
    if (rawLines.length === 0) continue;

    // Skip NOTE / STYLE / REGION blocks entirely.
    const first = rawLines[0]?.trim() ?? '';
    if (/^(NOTE|STYLE|REGION)\b/.test(first)) continue;

    let timingIndex = -1;
    let cueIndex = 0;

    if (CUE_TIMING.test(first)) {
      timingIndex = 0;
    } else if (rawLines.length > 1) {
      cueIndex = Number.parseInt(first, 10);
      timingIndex = 1;
    }

    const timingLine = timingIndex === -1 ? undefined : rawLines[timingIndex];
    if (timingLine === undefined) {
      diagnostics.push({ index: cueIndex, reason: 'Cue has no timing line', raw: block });
      continue;
    }

    const match = CUE_TIMING.exec(timingLine.trim());
    const startRaw = match?.[1];
    const endRaw = match?.[2];
    if (match === null || startRaw === undefined || endRaw === undefined) {
      diagnostics.push({ index: cueIndex, reason: 'Malformed timing line', raw: timingLine });
      continue;
    }

    const startMs = parseClockTimestamp(startRaw.replace(',', '.'));
    const endMs = parseClockTimestamp(endRaw.replace(',', '.'));
    if (startMs === null || endMs === null) {
      diagnostics.push({ index: cueIndex, reason: 'Unparseable timestamp', raw: timingLine });
      continue;
    }

    const text = rawLines
      .slice(timingIndex + 1)
      .join('\n')
      .trim();

    lines.push({
      index: lines.length,
      startMs,
      endMs: Math.max(startMs, endMs),
      text: stripCueMarkup(text),
      words: [],
    });
  }

  lines.sort((a, b) => a.startMs - b.startMs);

  return {
    doc: LyricsDocSchema.parse({
      provider: format,
      synced: lines.length > 0,
      lines: lines.map((line, index) => ({ ...line, index })),
      offsetMs: 0,
      metadata: { format },
    }),
    diagnostics,
  };
}

/**
 * Remove WebVTT cue markup so the rendered subtitle is plain text. Voice spans
 * (`<v Roger Bingham>`) collapse to the name, which is what a reader wants.
 * Word-level `<00:00:01.000>` timing tags are dropped; their text survives.
 */
export function stripCueMarkup(text: string): string {
  return text
    .replace(/<\d{2}:\d{2}:\d{2}\.\d{3}>/g, '')
    .replace(/<v[.^][^>]*>/g, '')
    .replace(/<v\s+([^>]*)>/g, '$1: ')
    .replace(/<\/?(c|b|i|u|ruby|rt|lang)(\.[^>]*)?>/g, '')
    .replace(/<[^>]*>/g, '')
    .trim();
}

export function toSrt(doc: LyricsDoc): string {
  const chunks = doc.lines.map((line, i) => {
    const endMs = line.endMs ?? line.startMs + 2000;
    return `${i + 1}\n${formatSrtTimestamp(line.startMs)} --> ${formatSrtTimestamp(endMs)}\n${line.text}`;
  });
  return `${chunks.join('\n\n')}\n`;
}

export function toVtt(doc: LyricsDoc): string {
  const chunks = doc.lines.map((line, i) => {
    const endMs = line.endMs ?? line.startMs + 2000;
    const numbering = doc.lines.length > 0 ? `${i + 1}\n` : '';
    return `${numbering}${formatVttTimestamp(line.startMs)} --> ${formatVttTimestamp(endMs)}\n${line.text}`;
  });
  return `WEBVTT\n\n${chunks.join('\n\n')}\n`;
}

/** Pick a codec by file extension; returns null for anything we do not handle. */
export function detectSubtitleFormat(filename: string): SubtitleFormat | null {
  const lower = filename.toLowerCase();
  if (lower.endsWith('.srt')) return 'srt';
  if (lower.endsWith('.vtt') || lower.endsWith('.webvtt')) return 'vtt';
  return null;
}
