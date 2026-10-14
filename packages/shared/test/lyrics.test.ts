import { describe, expect, it } from 'vitest';

import {
  lyricsToPlainText,
  normalizeLyricsDoc,
  parseLrc,
  plainTextToLyricsDoc,
  splitWords,
  toLrc,
} from '../src/lyrics.js';

const SAMPLE = `[ar:Demo Artist]
[ti:Demo Song]
[00:12.00]First line
[00:15.50]Second line
[00:19.00]
[00:23.20]Fourth line
`;

describe('parseLrc', () => {
  it('reads metadata tags and timed lines', () => {
    const { doc, diagnostics } = parseLrc(SAMPLE, { provider: 'test' });

    expect(doc.provider).toBe('test');
    expect(doc.synced).toBe(true);
    expect(doc.metadata['ar']).toBe('Demo Artist');
    expect(doc.metadata['ti']).toBe('Demo Song');
    expect(doc.lines.map((line) => line.text)).toEqual([
      'First line',
      'Second line',
      '',
      'Fourth line',
    ]);
    expect(doc.lines[0]?.startMs).toBe(12_000);
    expect(doc.lines[1]?.startMs).toBe(15_500);
    expect(diagnostics).toHaveLength(0);
  });

  it('keeps blank lines so instrumental gaps are representable', () => {
    const { doc } = parseLrc(SAMPLE);
    const blank = doc.lines[2];
    expect(blank).toBeDefined();
    expect(blank?.text).toBe('');
  });

  it('sets endMs from the next line and null on the last', () => {
    const { doc } = parseLrc(SAMPLE);
    expect(doc.lines[0]?.endMs).toBe(15_500);
    expect(doc.lines[2]?.endMs).toBe(23_200);
    expect(doc.lines[3]?.endMs).toBeNull();
  });

  it('expands a line carrying several timestamps', () => {
    const { doc } = parseLrc('[00:10.00][01:10.00][02:10.00]Chorus');
    expect(doc.lines).toHaveLength(3);
    expect(doc.lines.map((line) => line.startMs)).toEqual([10_000, 70_000, 130_000]);
    expect(doc.lines.every((line) => line.text === 'Chorus')).toBe(true);
  });

  it('sorts out-of-order timestamps', () => {
    const { doc } = parseLrc('[00:30.00]Third\n[00:10.00]First\n[00:20.00]Second');
    expect(doc.lines.map((line) => line.text)).toEqual(['First', 'Second', 'Third']);
    expect(doc.lines.map((line) => line.index)).toEqual([0, 1, 2]);
  });

  it('deduplicates identical timestamp+text pairs', () => {
    const { doc } = parseLrc('[00:10.00]Same\n[00:10.00]Same');
    expect(doc.lines).toHaveLength(1);
  });

  it('applies the [offset:] tag per the LRC convention (positive shifts earlier)', () => {
    const { doc } = parseLrc('[offset:+500]\n[00:10.00]Line');
    expect(doc.lines[0]?.startMs).toBe(9_500);
    expect(doc.metadata['offset']).toBe('500');
  });

  it('never produces a negative timestamp for a large positive offset', () => {
    const { doc } = parseLrc('[offset:+5000]\n[00:01.00]Line');
    expect(doc.lines[0]?.startMs).toBe(0);
  });

  it('reports junk lines as diagnostics instead of throwing', () => {
    const { doc, diagnostics } = parseLrc('this is not a lyric\n[00:01.00]Real line');
    expect(doc.lines).toHaveLength(1);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]?.line).toBe(1);
    expect(diagnostics[0]?.reason).toMatch(/neither a timestamp nor a tag/);
  });

  it('reports a non-numeric offset tag', () => {
    const { diagnostics } = parseLrc('[offset:soon]\n[00:01.00]Line');
    expect(diagnostics[0]?.reason).toMatch(/Non-numeric offset/);
  });

  it('marks an input with no timestamps as unsynced rather than failing', () => {
    const { doc } = parseLrc('just\nsome\ntext');
    expect(doc.synced).toBe(false);
    expect(doc.lines).toHaveLength(0);
  });

  it('handles CRLF line endings and a BOM', () => {
    const { doc } = parseLrc('\uFEFF[00:01.00]One\r\n[00:02.00]Two\r\n');
    expect(doc.lines.map((line) => line.text)).toEqual(['One', 'Two']);
  });

  it('spreads word timings across each line without overshooting', () => {
    const { doc } = parseLrc('[00:10.00]one two three\n[00:14.00]next');
    const first = doc.lines[0];
    expect(first?.words.map((word) => word.word)).toEqual(['one', 'two', 'three']);
    expect(first?.words[0]?.startMs).toBe(10_000);
    expect(first?.words.at(-1)?.endMs).toBe(14_000);
  });
});

describe('toLrc', () => {
  it('round-trips a synced document', () => {
    const original = parseLrc(SAMPLE, { provider: 'lrclib' }).doc;
    const reparsed = parseLrc(toLrc(original), { provider: 'lrclib' }).doc;

    expect(reparsed.lines.map((line) => [line.startMs, line.text])).toEqual(
      original.lines.map((line) => [line.startMs, line.text]),
    );
  });

  it('writes a LyricLens re-identifier and known metadata', () => {
    const output = toLrc(parseLrc(SAMPLE).doc);
    expect(output).toContain('[re:LyricLens]');
    expect(output).toContain('[ar:Demo Artist]');
    expect(output).toContain('[ti:Demo Song]');
  });

  it('emits three-digit fractions when requested', () => {
    const output = toLrc(parseLrc('[00:01.234]x').doc, { fractionDigits: 3 });
    expect(output).toContain('[00:01.234]');
  });
});

describe('splitWords', () => {
  it('splits on whitespace and drops empties', () => {
    expect(splitWords('  hello   world  ')).toEqual(['hello', 'world']);
    expect(splitWords('')).toEqual([]);
  });

  it('keeps punctuation attached', () => {
    expect(splitWords("don't stop, now!")).toEqual(["don't", 'stop,', 'now!']);
  });

  it('splits CJK per character and keeps latin runs intact', () => {
    expect(splitWords('hello你好world')).toEqual(['hello', '你', '好', 'world']);
  });
});

describe('normalizeLyricsDoc', () => {
  it('sorts, indexes and derives ends', () => {
    const doc = normalizeLyricsDoc({
      provider: 'whisper',
      lines: [
        { startMs: 5_000, text: 'b' },
        { startMs: 1_000, text: 'a' },
      ],
    });
    expect(doc.provider).toBe('whisper');
    expect(doc.lines.map((line) => line.text)).toEqual(['a', 'b']);
    expect(doc.lines[0]?.endMs).toBe(5_000);
    expect(doc.lines[1]?.endMs).toBeNull();
  });

  it('honours an explicit endMs from the provider', () => {
    const doc = normalizeLyricsDoc({
      provider: 'whisperx',
      lines: [{ startMs: 0, text: 'a', endMs: 900 }],
    });
    expect(doc.lines[0]?.endMs).toBe(900);
  });

  it('never emits an end before the start', () => {
    const doc = normalizeLyricsDoc({
      provider: 'x',
      lines: [{ startMs: 1_000, text: 'a', endMs: 500 }],
    });
    expect(doc.lines[0]?.endMs).toBe(1_000);
  });

  it('validates through the zod schema', () => {
    const doc = normalizeLyricsDoc({ provider: 'x', lines: [{ startMs: 0, text: 'a' }] });
    expect(() =>
      normalizeLyricsDoc({ provider: 'x', lines: [{ startMs: -5, text: 'a' }] }),
    ).not.toThrow();
    expect(doc.offsetMs).toBe(0);
  });
});

describe('plainTextToLyricsDoc', () => {
  it('builds an unsynced document from bare text', () => {
    const doc = plainTextToLyricsDoc('one\n\ntwo\n');
    expect(doc.synced).toBe(false);
    expect(doc.lines.map((line) => line.text)).toEqual(['one', 'two']);
    expect(doc.lines[0]?.endMs).toBeNull();
  });
});

describe('lyricsToPlainText', () => {
  it('flattens to one line per lyric', () => {
    const { doc } = parseLrc(SAMPLE);
    expect(lyricsToPlainText(doc)).toBe('First line\nSecond line\n\nFourth line\n');
  });
});
