import { config as loadDotenv } from 'dotenv';
import { defineConfig } from 'drizzle-kit';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { resolveDatabaseUrl } from './src/db/url.js';

// drizzle-kit reads DATABASE_URL from the environment; load the repo-root .env
// so `pnpm db:generate` works on a fresh clone with no extra ceremony.
const here = dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: resolve(here, '../../../.env'), quiet: true });

const url = process.env['DATABASE_URL'] ?? 'file:./var/lyriclens.db';

export default defineConfig({
  dialect: 'sqlite',
  schema: './src/db/schema.ts',
  out: './drizzle',
  dbCredentials: {
    // Same resolver the runtime uses, so generate and migrate never disagree.
    url: resolveDatabaseUrl(url),
    ...(process.env['DATABASE_AUTH_TOKEN'] !== undefined
      ? { authToken: process.env['DATABASE_AUTH_TOKEN'] }
      : {}),
  },
});
