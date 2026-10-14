import { z } from 'zod';

/**
 * Server environment schema.
 *
 * Two rules drive the shape of this file:
 *  1. **Nothing is required to boot.** A fresh clone with no `.env` must run —
 *     a missing optional credential disables one adapter and the UI says so.
 *  2. **Production is strict.** Secrets and the media encryption key are
 *     enforced here so a misconfigured deploy fails fast instead of silently
 *     storing user uploads in plaintext.
 */

const emptyToUndefined = (value: unknown): unknown =>
  value === '' || value === null ? undefined : value;

const optionalString = z.preprocess(emptyToUndefined, z.string().optional());
const optionalUrl = z.preprocess(emptyToUndefined, z.string().url().optional());

const port = (fallback: number) =>
  z.preprocess(emptyToUndefined, z.coerce.number().int().min(1).max(65535).default(fallback));

/**
 * `z.coerce.boolean()` is useless here: every non-empty string is truthy, so
 * `"false"` would become `true`. Parse an explicit enum instead, and apply the
 * default in the *input* space (before the transform) so the output is a real
 * boolean.
 */
const booleanish = (fallback: boolean) =>
  z.preprocess(
    (value) => (value === undefined || value === '' ? undefined : String(value).toLowerCase()),
    z
      .enum(['true', 'false', '1', '0', 'yes', 'no', 'on', 'off'])
      .default(fallback ? 'true' : 'false')
      .transform((value) => value === 'true' || value === '1' || value === 'yes' || value === 'on'),
  );

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // --- ports / origins ---------------------------------------------------
  API_PORT: port(4000),
  WEB_PORT: port(3000),
  SPEECH_PORT: port(4001),
  RENDER_PORT: port(4002),
  API_PUBLIC_URL: optionalUrl,
  WEB_PUBLIC_URL: optionalUrl,
  CORS_ORIGINS: optionalString,

  // --- database ----------------------------------------------------------
  DATABASE_URL: z.string().min(1).default('file:./var/lyriclens.db'),
  DATABASE_AUTH_TOKEN: optionalString,

  // --- storage -----------------------------------------------------------
  STORAGE_DRIVER: z.enum(['local', 's3']).default('local'),
  STORAGE_LOCAL_PATH: z.string().min(1).default('./storage'),
  S3_ENDPOINT: optionalUrl,
  S3_REGION: optionalString,
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  MEDIA_ENCRYPTION_KEY: optionalString,

  // --- auth --------------------------------------------------------------
  JWT_ACCESS_SECRET: optionalString,
  JWT_REFRESH_SECRET: optionalString,
  ACCESS_TOKEN_TTL: z.string().min(1).default('15m'),
  REFRESH_TOKEN_TTL: z.string().min(1).default('30d'),
  COOKIE_DOMAIN: optionalString,
  COOKIE_SECURE: booleanish(false),
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,
  SPOTIFY_CLIENT_ID: optionalString,
  SPOTIFY_CLIENT_SECRET: optionalString,
  OAUTH_REDIRECT_URL: optionalUrl,

  // --- lyrics / music ----------------------------------------------------
  LRCLIB_BASE_URL: z.string().url().default('https://lrclib.net/api'),
  LRCLIB_USER_AGENT: z.string().min(1).default('LyricLens/0.0.0 (https://github.com/lyriclens)'),
  MUSIXMATCH_APP_ID: optionalString,
  MUSIXMATCH_APP_SECRET: optionalString,
  SPOTIFY_WEB_PLAYBACK_ENABLED: booleanish(false),
  SONG_RECOGNITION_PROVIDER: z.enum(['audd', 'acrcloud', 'none']).default('none'),
  AUDD_API_TOKEN: optionalString,
  ACRCLOUD_API_KEY: optionalString,
  ACRCLOUD_API_SECRET: optionalString,
  MUSICBRAINZ_USER_AGENT: z.string().min(1).default('LyricLens/0.0.0'),

  // --- subtitles / video -------------------------------------------------
  OPENSUBTITLES_API_KEY: optionalString,
  OPENSUBTITLES_USERNAME: optionalString,
  OPENSUBTITLES_PASSWORD: optionalString,
  MAX_UPLOAD_MB: z.coerce.number().int().positive().max(102_400).default(2048),

  // --- speech ------------------------------------------------------------
  WHISPER_MODEL: z.enum(['tiny', 'base', 'small', 'medium']).default('tiny'),
  WHISPER_DEVICE: z.string().min(1).default('cpu'),
  WHISPER_COMPUTE_TYPE: z.string().min(1).default('int8'),
  WHISPER_LANGUAGE: optionalString,

  // --- llm / tts ---------------------------------------------------------
  LLM_BASE_URL: optionalUrl,
  LLM_API_KEY: optionalString,
  LLM_MODEL: optionalString,
  TTS_PROVIDER: z.enum(['piper', 'cloud', 'none']).default('none'),
  PIPER_BINARY_PATH: optionalString,
  PIPER_MODEL_PATH: optionalString,
  TTS_CLOUD_API_KEY: optionalString,

  // --- push --------------------------------------------------------------
  VAPID_PUBLIC_KEY: optionalString,
  VAPID_PRIVATE_KEY: optionalString,
  VAPID_SUBJECT: optionalString,

  // --- observability -----------------------------------------------------
  LOG_LEVEL: z.enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent']).default('info'),
  LOG_PRETTY: booleanish(true),
});

/**
 * Settings that are mandatory once `NODE_ENV=production`.
 *
 * Kept out of the zod schema on purpose: a `superRefine` is skipped whenever
 * the base object fails to parse, so a config with a bad port would hide the
 * missing secrets. Running these separately means one error report lists
 * everything the operator has to fix.
 */
const PRODUCTION_REQUIREMENTS = [
  { key: 'JWT_ACCESS_SECRET', message: 'JWT_ACCESS_SECRET is required in production' },
  { key: 'JWT_REFRESH_SECRET', message: 'JWT_REFRESH_SECRET is required in production' },
  { key: 'MEDIA_ENCRYPTION_KEY', message: 'MEDIA_ENCRYPTION_KEY is required in production' },
  { key: 'VAPID_PUBLIC_KEY', message: 'VAPID_PUBLIC_KEY is required in production' },
  { key: 'VAPID_PRIVATE_KEY', message: 'VAPID_PRIVATE_KEY is required in production' },
] as const;

export type Env = z.infer<typeof EnvSchema>;

export interface LoadEnvResult {
  env: Env;
  /** Human-readable notes for the boot log, e.g. "AudD disabled: no token". */
  notes: string[];
}

/**
 * Validate the environment. Throws with every problem listed at once rather
 * than failing on the first, so a deploy author fixes them in one pass.
 */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): LoadEnvResult {
  const parsed = EnvSchema.safeParse(source);
  const problems: string[] = [];

  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      problems.push(`  - ${issue.path.join('.') || '(root)'}: ${issue.message}`);
    }
  }

  // Read NODE_ENV straight from the source so production checks still run even
  // when the rest of the config is broken.
  if (source['NODE_ENV'] === 'production') {
    for (const { key, message } of PRODUCTION_REQUIREMENTS) {
      const value = source[key];
      if (typeof value !== 'string' || value.trim() === '') problems.push(`  - ${key}: ${message}`);
    }
    if (source['COOKIE_SECURE'] !== 'true') {
      problems.push('  - COOKIE_SECURE: COOKIE_SECURE must be true in production');
    }
  }

  if (problems.length > 0 || !parsed.success) {
    throw new Error(`Invalid environment configuration:\n${problems.join('\n')}`);
  }

  const env = parsed.data;
  const notes: string[] = [];

  if (env.SONG_RECOGNITION_PROVIDER === 'audd' && env.AUDD_API_TOKEN === undefined) {
    notes.push("Song recognition set to 'audd' but AUDD_API_TOKEN is empty — provider disabled.");
  }
  if (env.SONG_RECOGNITION_PROVIDER === 'acrcloud' && env.ACRCLOUD_API_KEY === undefined) {
    notes.push(
      "Song recognition set to 'acrcloud' but ACRCLOUD_API_KEY is empty — provider disabled.",
    );
  }
  if (env.TTS_PROVIDER === 'piper' && env.PIPER_MODEL_PATH === undefined) {
    notes.push("TTS set to 'piper' but PIPER_MODEL_PATH is empty — pronunciation disabled.");
  }
  if (env.STORAGE_DRIVER === 's3' && env.S3_BUCKET === undefined) {
    notes.push('STORAGE_DRIVER=s3 but S3_BUCKET is empty — falling back is NOT automatic.');
  }
  if (env.NODE_ENV !== 'production' && env.MEDIA_ENCRYPTION_KEY === undefined) {
    notes.push('MEDIA_ENCRYPTION_KEY is unset — uploads are stored unencrypted (dev only).');
  }

  return { env, notes };
}

/** Comma-separated origin list, normalised and de-duplicated. */
export function parseCorsOrigins(raw: string | undefined): string[] {
  if (raw === undefined || raw.trim() === '') return [];
  return [
    ...new Set(
      raw
        .split(',')
        .map((value) => value.trim())
        .filter((value) => value !== ''),
    ),
  ];
}
