import { describe, expect, it } from 'vitest';

import {
  clamp,
  formatDuration,
  formatDurationHuman,
  formatLrcTimestamp,
  formatSrtTimestamp,
  formatVttTimestamp,
  parseClockTimestamp,
} from '../src/time.js';

describe('parseClockTimestamp', () => {
  it('parses mm:ss', () => {
    expect(parseClockTimestamp('00:12')).toBe(12_000);
    expect(parseClockTimestamp('01:30')).toBe(90_000);
  });

  it('parses mm:ss.xx and mm:ss.xxx', () => {
    expect(parseClockTimestamp('00:12.34')).toBe(12_340);
    expect(parseClockTimestamp('00:12.345')).toBe(12_345);
  });

  it('scales fractional digits by place value, not as a decimal', () => {
    expect(parseClockTimestamp('00:01.5')).toBe(1_500);
    expect(parseClockTimestamp('00:01.05')).toBe(1_050);
    expect(parseClockTimestamp('00:01.005')).toBe(1_005);
    expect(parseClockTimestamp('00:01.0001')).toBe(1_000);
  });

  it('parses hh:mm:ss.xxx', () => {
    expect(parseClockTimestamp('01:02:03.456')).toBe(3_723_456);
  });

  it('accepts a comma decimal separator (common in hand-written SRT)', () => {
    expect(parseClockTimestamp('00:01,500')).toBe(1_500);
  });

  it('rejects malformed input instead of guessing', () => {
    for (const bad of ['', '   ', '12', 'aa:bb', '00:', ':30', '00:12.', '00:12.xx', '1:2:3:4']) {
      expect(parseClockTimestamp(bad)).toBeNull();
    }
  });

  it('tolerates surrounding whitespace', () => {
    expect(parseClockTimestamp('  00:12.00  ')).toBe(12_000);
  });
});

describe('formatLrcTimestamp', () => {
  it('emits two-digit centiseconds by default', () => {
    expect(formatLrcTimestamp(12_340)).toBe('[00:12.34]');
    expect(formatLrcTimestamp(0)).toBe('[00:00.00]');
  });

  it('emits milliseconds when asked', () => {
    expect(formatLrcTimestamp(12_345, 3)).toBe('[00:12.345]');
  });

  it('carries rounding into the next second instead of emitting :60.00', () => {
    expect(formatLrcTimestamp(59_995)).toBe('[01:00.00]');
  });

  it('carries rounding into the next minute', () => {
    expect(formatLrcTimestamp(119_999)).toBe('[02:00.00]');
  });

  it('adds hours only when needed', () => {
    expect(formatLrcTimestamp(3_600_000)).toBe('[01:00:00.00]');
    // 3599.999s rounds up to a whole hour, so it must carry into the hours field.
    expect(formatLrcTimestamp(3_599_999)).toBe('[01:00:00.00]');
    expect(formatLrcTimestamp(3_599_989)).toBe('[59:59.99]');
  });

  it('clamps negatives to zero', () => {
    expect(formatLrcTimestamp(-500)).toBe('[00:00.00]');
  });

  it('round-trips through the parser', () => {
    for (const ms of [0, 1_000, 12_340, 61_005, 599_995, 3_723_456]) {
      const formatted = formatLrcTimestamp(ms, 3);
      expect(parseClockTimestamp(formatted.slice(1, -1))).toBe(ms);
    }
  });
});

describe('formatSrtTimestamp / formatVttTimestamp', () => {
  it('always emits hours and uses a comma for SRT', () => {
    expect(formatSrtTimestamp(3_723_456)).toBe('01:02:03,456');
  });

  it('uses a dot for WebVTT', () => {
    expect(formatVttTimestamp(3_723_456)).toBe('01:02:03.456');
  });
});

describe('clamp', () => {
  it('bounds a value', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-1, 0, 10)).toBe(0);
    expect(clamp(11, 0, 10)).toBe(10);
  });

  it('falls back to the minimum for NaN', () => {
    expect(clamp(Number.NaN, 3, 10)).toBe(3);
  });
});

describe('duration formatting', () => {
  it('formats as m:ss', () => {
    expect(formatDuration(187_000)).toBe('3:07');
    expect(formatDuration(0)).toBe('0:00');
  });

  it('formats human durations for cards', () => {
    expect(formatDurationHuman(3_723_456)).toBe('1h 02m');
    expect(formatDurationHuman(750_000)).toBe('12m 30s');
    expect(formatDurationHuman(48_000)).toBe('48s');
  });
});
