/**
 * Feature flags.
 *
 * Every surface added after the foundation lands behind a flag that defaults to
 * `false`, so a partially-delivered phase can never be reached accidentally from
 * the UI. Overrides come from `FEATURE_<NAME>=true` in the environment, which is
 * what CI and local QA use; the defaults in code are the source of truth for
 * production.
 */

export const FEATURE_FLAGS = {
  /** Windows SMTC / macOS NowPlaying / Linux MPRIS overlay. */
  music_overlay: true,
  /** Web paths: Spotify Connect, Identify song, manual search. */
  music_web: true,
  /** Manifest, service worker, install prompt, offline shell. */
  pwa: false,
  /** Saved sessions, playlists, favourites, history, replay. */
  library: false,
  /** Upload + Whisper pipeline + synced subtitle view. */
  video_mode: false,
  /** Full-screen Lyric Scene Player with karaoke highlight. */
  scene_player: false,
  /** PNG / LRC / SRT / VTT / MP4 export. */
  exports: false,
  /** Learn hub, lessons, vocabulary, SRS, exercises. */
  learn_dashboard: false,
  /** TTS, A-B loop, shadowing, pronunciation scoring. */
  pronunciation: false,
  /** Web Push reminders for streaks and reviews. */
  web_push: false,
  /** Document Picture-in-Picture floating lyrics in the browser. */
  browser_floating_lyrics: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;
export type FeatureFlagValue = boolean;

/** Ordered list, used by `/v1/flags` and by the dev tooling. */
export const FEATURE_FLAG_NAMES = Object.keys(FEATURE_FLAGS) as FeatureFlag[];

export const DEFAULT_FEATURE_FLAGS: Readonly<Record<FeatureFlag, boolean>> = Object.freeze({
  ...FEATURE_FLAGS,
});

export function envKeyForFlag(flag: FeatureFlag): string {
  return `FEATURE_${flag.toUpperCase()}`;
}

function coerce(raw: string | undefined): boolean | undefined {
  if (raw === undefined) return undefined;
  const value = raw.trim().toLowerCase();
  if (value === '' || value === 'true' || value === '1' || value === 'yes' || value === 'on') {
    return true;
  }
  if (value === 'false' || value === '0' || value === 'no' || value === 'off') return false;
  return undefined;
}

export type FeatureFlagSource = Readonly<Record<string, string | undefined>>;

export interface ResolvedFlags {
  values: Record<FeatureFlag, boolean>;
  /** Which flags were changed from their code default, and by what. */
  overrides: Array<{ flag: FeatureFlag; value: boolean; source: 'env' | 'default' }>;
}

/**
 * Resolve every flag against the environment. Unknown `FEATURE_*` keys are
 * ignored rather than fatal, so a stale variable cannot break startup.
 */
export function resolveFeatureFlags(env: FeatureFlagSource = process.env): ResolvedFlags {
  const values = {} as Record<FeatureFlag, boolean>;
  const overrides: ResolvedFlags['overrides'] = [];

  for (const flag of FEATURE_FLAG_NAMES) {
    const fromEnv = coerce(env[envKeyForFlag(flag)]);
    if (fromEnv === undefined) {
      values[flag] = FEATURE_FLAGS[flag];
      overrides.push({ flag, value: FEATURE_FLAGS[flag], source: 'default' });
    } else {
      values[flag] = fromEnv;
      overrides.push({ flag, value: fromEnv, source: 'env' });
    }
  }

  return { values, overrides };
}

export function isFeatureEnabled(
  flags: Readonly<Record<FeatureFlag, boolean>>,
  flag: FeatureFlag,
): boolean {
  return flags[flag] === true;
}
