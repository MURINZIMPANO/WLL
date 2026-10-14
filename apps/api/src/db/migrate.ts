import { config as loadDotenv } from 'dotenv';
import { migrate } from 'drizzle-orm/libsql/migrator';
import { existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { isLocalDatabase, openDatabase } from './client.js';
import { REPO_ROOT, localPathFor, resolveDatabaseUrl } from './url.js';

/**
 * Apply pending migrations.
 *
 * Run via `pnpm db:migrate`. Safe to run repeatedly — drizzle records applied
 * migrations in `__drizzle_migrations` and skips them.
 *
 * WAL is enabled for local files: the API reads while a worker writes, and the
 * default journal mode would otherwise throw SQLITE_BUSY under concurrency.
 */

const HERE = dirname(fileURLToPath(import.meta.url)); // .../apps/api/src/db
/** .../apps/api/drizzle — exported so tests can migrate an isolated database. */
export const MIGRATIONS_FOLDER = resolve(HERE, '../../drizzle');

export async function runMigrations(databaseUrl: string, authToken?: string): Promise<void> {
  const url = resolveDatabaseUrl(databaseUrl);

  const filePath = localPathFor(url);
  if (filePath !== null) {
    mkdirSync(dirname(filePath), { recursive: true });
  }

  if (!existsSync(MIGRATIONS_FOLDER)) {
    throw new Error(`No migrations found at ${MIGRATIONS_FOLDER}. Run \`pnpm db:generate\` first.`);
  }

  const handle = openDatabase(url, authToken);
  try {
    if (isLocalDatabase(url)) {
      await handle.client.execute('PRAGMA journal_mode = WAL');
      await handle.client.execute('PRAGMA foreign_keys = ON');
      await handle.client.execute('PRAGMA busy_timeout = 5000');
    }
    await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });
  } finally {
    handle.close();
  }
}

// Only run automatically when invoked directly, not when imported by a test.
const invokedDirectly =
  process.argv[1] !== undefined &&
  fileURLToPath(import.meta.url).replace(/\\/g, '/') ===
    resolve(process.argv[1]).replace(/\\/g, '/');

if (invokedDirectly) {
  loadDotenv({ path: resolve(REPO_ROOT, '.env'), quiet: true });

  const url = process.env['DATABASE_URL'] ?? 'file:./var/lyriclens.db';
  const token = process.env['DATABASE_AUTH_TOKEN'];

  runMigrations(url, token)
    .then(() => {
      console.log(`Migrations applied to ${resolveDatabaseUrl(url)}`);
    })
    .catch((error: unknown) => {
      console.error('Migration failed:', error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
