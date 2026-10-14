import { describe, expect, it } from 'vitest';

import {
  detectSubtitleFormat,
  parseSubtitles,
  stripCueMarkup,
  toSrt,
  toVtt,
} from '../src/subtitles.js';

const SRT = `1
00:00:01,000 --> 00:00:04,000
Hello there

2
00:00:04,500 --> 00:00:07,000
General Kenobi
`;

const VTT = `WEBVTT

NOTE this is a comment

1
00:00:01.000 --> 00:00:04.000 line:90%
Hello there

00:05.000 --> 00:07.000
<c.yellow>Short</c> form
`;

describe('parseSubtitles (srt)', () => {
  it('parses cues with sequential numbering', () => {
    const { doc, diagnostics } = parseSubtitles(SRT, 'srt');
    expect(doc.synced).toBe(true);
    expect(doc.provider).toBe('srt');
    expect(doc.lines.map((line) => line.text)).toEqual(['Hello there', 'General Kenobi']);
    expect(doc.lines[0]?.startMs).toBe(1_000);
    expect(doc.lines[0]?.endMs).toBe(4_000);
    expect(doc.lines[1]?.startMs).toBe(4_500);
    expect(diagnostics).toHaveLength(0);
  });

  it('ignores a trailing numeric index and re-indexes from zero', () => {
    const { doc } = parseSubtitles(SRT, 'srt');
    expect(doc.lines.map((line) => line.index)).toEqual([0, 1]);
  });

  it('joins multi-line cue text', () => {
    const { doc } = parseSubtitles(`1\n00:00:01,000 --> 00:00:04,000\nline one\nline two\n`, 'srt');
    expect(doc.lines[0]?.text).toBe('line one\nline two');
  });

  it('tolerates CRLF and a BOM', () => {
    const { doc } = parseSubtitles('\uFEFF1\r\n00:00:01,000 --> 00:00:02,000\r\nHi\r\n', 'srt');
    expect(doc.lines[0]?.text).toBe('Hi');
  });
});

describe('parseSubtitles (vtt)', () => {
  it('drops the WEBVTT signature and NOTE blocks', () => {
    const { doc } = parseSubtitles(VTT, 'vtt');
    expect(doc.lines.map((line) => line.text)).toEqual(['Hello there', 'Short form']);
  });

  it('parses cue settings after the end timestamp', () => {
    const { doc } = parseSubtitles(VTT, 'vtt');
    expect(doc.lines[0]?.endMs).toBe(4_000);
  });

  it('accepts hour-less mm:ss.mmm timestamps', () => {
    const { doc } = parseSubtitles(VTT, 'vtt');
    expect(doc.lines[1]?.startMs).toBe(5_000);
  });

  it('strips inline cue markup from the rendered text', () => {
    const { doc } = parseSubtitles(VTT, 'vtt');
    expect(doc.lines[1]?.text).not.toContain('<');
  });
});

describe('parseSubtitles diagnostics', () => {
  it('records a cue with no timing line', () => {
    const { doc, diagnostics } = parseSubtitles('just some text\n', 'srt');
    expect(doc.lines).toHaveLength(0);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.reason).toMatch(/no timing line/);
  });

  it('records an unparseable timestamp', () => {
    const { doc, diagnostics } = parseSubtitles(`1\nnot-a-time --> also-bad\nText\n`, 'srt');
    expect(doc.lines).toHaveLength(0);
    expect(diagnostics[0]?.reason).toMatch(/Unparseable timestamp/);
  });

  it('never throws on empty input', () => {
    expect(parseSubtitles('', 'srt').doc.lines).toHaveLength(0);
    expect(parseSubtitles('', 'vtt').doc.lines).toHaveLength(0);
  });

  it('never emits an end before the start', () => {
    const { doc } = parseSubtitles(`1\n00:00:05,000 --> 00:00:01,000\nBackwards\n`, 'srt');
    expect(doc.lines[0]?.endMs).toBe(5_000);
  });
});

describe('stripCueMarkup', () => {
  it('keeps the speaker name and drops the tag', () => {
    expect(stripCueMarkup('<v Roger Bingham>Hello')).toBe('Roger Bingham: Hello');
  });

  it('drops word-level timing tags but keeps the words', () => {
    expect(stripCueMarkup('<00:00:01.000>He<00:00:02.000>llo')).toBe('Hello');
  });

  it('drops styling tags', () => {
    expect(stripCueMarkup('<c.yellow><b>Hi</b></c>')).toBe('Hi');
  });
});

describe('toSrt / toVtt', () => {
  const doc = parseSubtitles(SRT, 'srt').doc;

  it('round-trips through SRT', () => {
    const reparsed = parseSubtitles(toSrt(doc), 'srt').doc;
    expect(reparsed.lines.map((line) => [line.startMs, line.endMs, line.text])).toEqual(
      doc.lines.map((line) => [line.startMs, line.endMs, line.text]),
    );
  });

  it('round-trips through VTT', () => {
    const reparsed = parseSubtitles(toVtt(doc), 'vtt').doc;
    expect(reparsed.lines.map((line) => [line.startMs, line.endMs, line.text])).toEqual(
      doc.lines.map((line) => [line.startMs, line.endMs, line.text]),
    );
  });

  it('always emits the WEBVTT signature', () => {
    expect(toVtt(doc).startsWith('WEBVTT')).toBe(true);
  });

  it('substitutes a default end when the line has none', () => {
    const withoutEnd = { ...doc, lines: [{ ...doc.lines[0]!, endMs: null }] };
    expect(toSrt(withoutEnd)).toContain('00:00:03,000');
  });
});

describe('detectSubtitleFormat', () => {
  it('recognises both extensions case-insensitively', () => {
    expect(detectSubtitleFormat('Movie.SRT')).toBe('srt');
    expect(detectSubtitleFormat('clip.webvtt')).toBe('vtt');
    expect(detectSubtitleFormat('subs.txt')).toBeNull();
  });
});
