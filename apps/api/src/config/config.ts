import { loadEnv, type Env } from '@lyriclens/shared';
import { config as loadDotenv } from 'dotenv';
import { resolve } from 'node:path';

export interface AppConfig {
  env: Env;
  /** Populated at boot, surfaced by /v1/health and printed once at startup. */
  notes: string[];
  isProduction: boolean;
}

/**
 * Load and validate configuration.
 *
 * Reads the repo-root `.env` if present, then the process environment, then
 * falls back to the defaults in the shared schema. Never throws for *missing
 * optional* configuration — a fresh clone boots with LRCLIB and manual search.
 */
export function loadConfig(): AppConfig {
  loadDotenv({ path: resolve(process.cwd(), '.env'), quiet: true });
  loadDotenv({ path: resolve(process.cwd(), '../../.env'), quiet: true });

  const { env, notes } = loadEnv(process.env);

  return { env, notes, isProduction: env.NODE_ENV === 'production' };
}
