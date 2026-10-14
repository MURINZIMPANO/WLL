import { describe, expect, it } from 'vitest';

import { REQUIRED_ENCODERS, missingEncoders, probeFfmpeg, type FfmpegInfo } from '../src/ffmpeg.js';

/**
 * These tests run against whatever ffmpeg the machine actually has. The point is
 * not to assert a specific version — it is to prove the probe reports the truth
 * in both directions (found and absent), because a silently-wrong probe turns
 * into a failed export in Phase 5.
 */

describe('probeFfmpeg', () => {
  it('reports a clean absence rather than throwing when the binary is missing', async () => {
    const info = await probeFfmpeg('definitely-not-a-real-binary-lyriclens');

    expect(info.available).toBe(false);
    expect(info.path).toBeNull();
    expect(info.version).toBeNull();
    expect(info.encoders).toEqual([]);
    expect(info.error).toBeTruthy();
  });

  it('describes the installed ffmpeg', async () => {
    const info = await probeFfmpeg();

    if (!info.available) {
      // Not an error: ffmpeg is optional and absent machines are supported.
      expect(info.error).toBeTruthy();
      return;
    }

    expect(info.available).toBe(true);
    expect(info.version).toMatch(/\d+\.\d+/);
    expect(info.encoders.length).toBeGreaterThan(0);
    expect(info.error).toBeNull();
  });
});

describe('missingEncoders', () => {
  const base: FfmpegInfo = {
    available: true,
    path: 'ffmpeg',
    version: '7.1',
    encoders: [],
    error: null,
  };

  it('lists every required encoder when none are present', () => {
    expect(missingEncoders(base)).toEqual([...REQUIRED_ENCODERS]);
  });

  it('returns an empty list when all required encoders are present', () => {
    expect(missingEncoders({ ...base, encoders: ['libx264', 'aac', 'libvpx-vp9'] })).toEqual([]);
  });

  it('names only what is actually missing', () => {
    expect(missingEncoders({ ...base, encoders: ['aac'] })).toEqual(['libx264']);
  });
});
