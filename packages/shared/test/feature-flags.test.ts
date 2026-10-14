import { describe, expect, it } from 'vitest';

import {
  DEFAULT_FEATURE_FLAGS,
  FEATURE_FLAG_NAMES,
  FEATURE_FLAGS,
  envKeyForFlag,
  isFeatureEnabled,
  resolveFeatureFlags,
} from '../src/feature-flags.js';

describe('feature flag registry', () => {
  it('ships the foundation flags on and every later surface off', () => {
    expect(FEATURE_FLAGS.music_overlay).toBe(true);
    expect(FEATURE_FLAGS.music_web).toBe(true);
    for (const flag of [
      'pwa',
      'library',
      'video_mode',
      'scene_player',
      'exports',
      'learn_dashboard',
      'pronunciation',
      'web_push',
      'browser_floating_lyrics',
    ] as const) {
      expect(FEATURE_FLAGS[flag], `${flag} must default to false`).toBe(false);
    }
  });

  it('derives a deterministic env key', () => {
    expect(envKeyForFlag('learn_dashboard')).toBe('FEATURE_LEARN_DASHBOARD');
    expect(envKeyForFlag('pwa')).toBe('FEATURE_PWA');
  });

  it('exposes the flag names as a readonly list', () => {
    expect(FEATURE_FLAG_NAMES).toContain('pwa');
    expect(FEATURE_FLAG_NAMES).toHaveLength(Object.keys(FEATURE_FLAGS).length);
  });
});

describe('resolveFeatureFlags', () => {
  it('uses code defaults when the environment is empty', () => {
    const { values, overrides } = resolveFeatureFlags({});
    expect(values).toEqual({ ...DEFAULT_FEATURE_FLAGS });
    expect(overrides.every((entry) => entry.source === 'default')).toBe(true);
  });

  it('applies truthy overrides', () => {
    const { values } = resolveFeatureFlags({
      FEATURE_PWA: 'true',
      FEATURE_LIBRARY: '1',
      FEATURE_EXPORTS: 'yes',
      FEATURE_WEB_PUSH: 'on',
    });
    expect(values.pwa).toBe(true);
    expect(values.library).toBe(true);
    expect(values.exports).toBe(true);
    expect(values.web_push).toBe(true);
  });

  it('applies falsy overrides, including turning a default-on flag off', () => {
    const { values } = resolveFeatureFlags({
      FEATURE_MUSIC_OVERLAY: 'false',
      FEATURE_PWA: 'off',
      FEATURE_LIBRARY: '0',
      FEATURE_EXPORTS: 'no',
    });
    expect(values.music_overlay).toBe(false);
    expect(values.pwa).toBe(false);
  });

  it('is case and whitespace insensitive', () => {
    const { values } = resolveFeatureFlags({ FEATURE_PWA: '  TRUE  ' });
    expect(values.pwa).toBe(true);
  });

  it('ignores unparseable values rather than failing startup', () => {
    const { values } = resolveFeatureFlags({ FEATURE_PWA: 'maybe' });
    expect(values.pwa).toBe(FEATURE_FLAGS.pwa);
  });

  it('ignores unknown FEATURE_* keys', () => {
    const { values } = resolveFeatureFlags({ FEATURE_DOES_NOT_EXIST: 'true' });
    expect(values).toEqual({ ...DEFAULT_FEATURE_FLAGS });
  });

  it('reports which flags were overridden', () => {
    const { overrides } = resolveFeatureFlags({ FEATURE_PWA: 'true' });
    expect(overrides.find((entry) => entry.flag === 'pwa')).toEqual({
      flag: 'pwa',
      value: true,
      source: 'env',
    });
  });
});

describe('isFeatureEnabled', () => {
  it('reads a resolved flag map', () => {
    expect(isFeatureEnabled({ ...DEFAULT_FEATURE_FLAGS }, 'music_overlay')).toBe(true);
    expect(isFeatureEnabled({ ...DEFAULT_FEATURE_FLAGS }, 'library')).toBe(false);
  });
});
