import { describe, expect, it } from 'vitest';

import { mostRestrictiveTerms, trackKey, type ProviderTerms } from '../src/providers.js';
import { backoffDelayMs, JobPayloadSchema } from '../src/queue.js';
import {
  buildStorageKey,
  contentTypeFor,
  isSupportedMediaFile,
  isSupportedSubtitleFile,
} from '../src/storage.js';
import { collect, err, isErr, isOk, mapResult, ok, unwrapOr } from '../src/result.js';

function terms(overrides: Partial<ProviderTerms> = {}): ProviderTerms {
  return {
    attributionRequired: false,
    maxDisplayLines: null,
    exportAllowed: true,
    exportFormats: ['lrc', 'txt'],
    cacheTtlSeconds: 3600,
    redistributionAllowed: false,
    ...overrides,
  };
}

describe('mostRestrictiveTerms', () => {
  it('refuses everything when there is no provider', () => {
    const result = mostRestrictiveTerms([]);
    expect(result.exportAllowed).toBe(false);
    expect(result.exportFormats).toEqual([]);
  });

  it('allows export only when every provider allows it', () => {
    expect(mostRestrictiveTerms([terms(), terms()]).exportAllowed).toBe(true);
    expect(mostRestrictiveTerms([terms(), terms({ exportAllowed: false })]).exportAllowed).toBe(
      false,
    );
  });

  it('unions formats but empties them when any provider forbids export', () => {
    expect(
      mostRestrictiveTerms([terms(), terms({ exportFormats: ['srt'] })]).exportFormats,
    ).toEqual(['lrc', 'txt', 'srt']);
    expect(
      mostRestrictiveTerms([terms(), terms({ exportAllowed: false, exportFormats: ['mp4'] })])
        .exportFormats,
    ).toEqual([]);
  });

  it('takes the lowest display cap and the shortest cache TTL', () => {
    const result = mostRestrictiveTerms([
      terms({ maxDisplayLines: 200, cacheTtlSeconds: 86_400 }),
      terms({ maxDisplayLines: 50, cacheTtlSeconds: 600 }),
      terms({ cacheTtlSeconds: 3_600 }),
    ]);
    expect(result.maxDisplayLines).toBe(50);
    expect(result.cacheTtlSeconds).toBe(600);
  });

  it('keeps maxDisplayLines null when no provider caps it', () => {
    expect(mostRestrictiveTerms([terms(), terms()]).maxDisplayLines).toBeNull();
  });

  it('requires attribution if any provider requires it, and keeps its text', () => {
    const result = mostRestrictiveTerms([
      terms(),
      terms({ attributionRequired: true, attributionText: 'Lyrics from Musixmatch' }),
    ]);
    expect(result.attributionRequired).toBe(true);
    expect(result.attributionText).toBe('Lyrics from Musixmatch');
  });

  it('never permits redistribution unless every provider does', () => {
    expect(
      mostRestrictiveTerms([terms({ redistributionAllowed: true }), terms()]).redistributionAllowed,
    ).toBe(false);
  });
});

describe('trackKey', () => {
  it('normalises case and whitespace', () => {
    expect(trackKey({ title: '  Hey Ya ', artist: 'OutKast' })).toBe('outkast::hey ya');
  });
});

describe('job payloads', () => {
  it('accepts a well-formed transcribe job and fills defaults', () => {
    const parsed = JobPayloadSchema.parse({
      kind: 'transcribe',
      sessionId: 's1',
      mediaKey: 'uploads/ab/abc123.mp4',
    });
    expect(parsed.kind).toBe('transcribe');
    if (parsed.kind !== 'transcribe') throw new Error('expected a transcribe payload');
    expect(parsed.modelSize).toBe('tiny');
    expect(parsed.wordLevelTimestamps).toBe(true);
  });

  it('rejects a payload whose kind is unknown', () => {
    expect(() => JobPayloadSchema.parse({ kind: 'nope', sessionId: 's1' })).toThrow();
  });

  it('bounds render dimensions', () => {
    expect(() =>
      JobPayloadSchema.parse({ kind: 'render', sessionId: 's1', width: 8_000 }),
    ).toThrow();
  });
});

describe('backoffDelayMs', () => {
  it('grows exponentially and stays under the cap', () => {
    const first = backoffDelayMs(1, 1_000);
    const third = backoffDelayMs(3, 1_000);
    const huge = backoffDelayMs(30, 1_000);

    expect(first).toBeGreaterThanOrEqual(1_000);
    expect(first).toBeLessThanOrEqual(1_250);
    expect(third).toBeGreaterThan(first);
    expect(huge).toBeLessThanOrEqual(300_000);
  });
});

describe('storage helpers', () => {
  it('shards keys by the first two characters of the id', () => {
    expect(buildStorageKey('uploads', 'abcdef123', 'mp4')).toBe('uploads/ab/abcdef123.mp4');
    expect(buildStorageKey('Uploads!', 'abcdef123', 'MP4')).toBe('uploads/ab/abcdef123.mp4');
  });

  it('omits the dot when there is no extension', () => {
    expect(buildStorageKey('covers', 'xy', '')).toBe('covers/xy/xy');
  });

  it('maps extensions to content types with a safe fallback', () => {
    expect(contentTypeFor('song.mp3')).toBe('audio/mpeg');
    expect(contentTypeFor('clip.WEBM')).toBe('video/webm');
    expect(contentTypeFor('subs.srt')).toBe('application/x-subrip');
    expect(contentTypeFor('mystery')).toBe('application/octet-stream');
  });

  it('recognises supported media and subtitle files', () => {
    expect(isSupportedMediaFile('a.mp3')).toBe(true);
    expect(isSupportedMediaFile('a.mkv')).toBe(true);
    expect(isSupportedMediaFile('a.pdf')).toBe(false);
    expect(isSupportedSubtitleFile('a.vtt')).toBe(true);
    expect(isSupportedSubtitleFile('a.lrc')).toBe(false);
  });
});

describe('Result', () => {
  it('constructs and narrows', () => {
    expect(isOk(ok(1))).toBe(true);
    expect(isErr(err('boom'))).toBe(true);
  });

  it('maps the success branch only', () => {
    expect(mapResult(ok(2), (n) => n * 2)).toEqual(ok(4));
    expect(mapResult(err<string>('boom'), (n: number) => n * 2)).toEqual(err('boom'));
  });

  it('unwraps with a fallback', () => {
    expect(unwrapOr(ok(5), 0)).toBe(5);
    expect(unwrapOr(err<string>('boom'), 0)).toBe(0);
  });

  it('collects until the first error', () => {
    expect(collect([ok(1), ok(2)])).toEqual(ok([1, 2]));
    expect(collect([ok(1), err('x'), err('y')])).toEqual(err('x'));
  });
});
