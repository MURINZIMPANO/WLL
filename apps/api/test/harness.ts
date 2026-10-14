import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

import { loadEnv, type Env } from '@lyriclens/shared';

import { buildApp, type App } from '../src/app.js';
import { openDatabase, type DatabaseHandle } from '../src/db/client.js';
import { MIGRATIONS_FOLDER, runMigrations } from '../src/db/migrate.js';
import { SqliteJobQueue } from '../src/queue/sqlite-queue.js';
import { LocalStorageDriver } from '../src/storage/local-driver.js';
import { migrate } from 'drizzle-orm/libsql/migrator';

/**
 * Integration test harness.
 *
 * These are true integration tests: a real SQLite file and a real temp
 * directory, no mocks. That is deliberate — the failure mode this project must
 * never ship ("my data vanished") comes from exactly the seams a mock would
 * paper over: URL resolution, migrations, and filesystem paths.
 */

export interface TestHarness {
  app: App;
  storageRoot: string;
  databasePath: string;
  cleanup(): Promise<void>;
}

export function testEnv(overrides: Partial<Env> = {}): Env {
  const { env } = loadEnv({ NODE_ENV: 'test', LOG_LEVEL: 'silent', LOG_PRETTY: 'false' });
  return { ...env, ...overrides };
}

export async function createHarness(
  options: { storage?: LocalStorageDriver; env?: Partial<Env> } = {},
): Promise<TestHarness> {
  const storageRoot = await mkdtemp(join(tmpdir(), 'lyriclens-test-'));
  const databasePath = join(storageRoot, 'test.db');

  await runMigrations(`file:${databasePath.replace(/\\/g, '/')}`);

  const database: DatabaseHandle = openDatabase(`file:${databasePath.replace(/\\/g, '/')}`);
  const env = testEnv({
    STORAGE_LOCAL_PATH: storageRoot,
    DATABASE_URL: `file:${databasePath.replace(/\\/g, '/')}`,
    ...options.env,
  });

  const storage =
    options.storage ??
    new LocalStorageDriver({
      root: storageRoot,
      ...(env.MEDIA_ENCRYPTION_KEY === undefined
        ? {}
        : { encryptionKeyHex: env.MEDIA_ENCRYPTION_KEY }),
    });

  const app = await buildApp({
    config: { env, notes: [], isProduction: false },
    database,
    storage,
  });

  return {
    app,
    storageRoot: resolve(storageRoot),
    databasePath,
    async cleanup() {
      await app.close();
      await removeWithRetry(storageRoot);
    },
  };
}

/** Absolute path helper for tests that assert on layout. */
export function abs(...parts: string[]): string {
  return resolve(...parts);
}

export interface QueueHarness {
  queue: SqliteJobQueue;
  close(): void;
}

/**
 * An isolated in-memory queue.
 *
 * Queue tests assert on global state ("claimNext returns null when the queue is
 * empty"), so sharing one database would make them order-dependent. An
 * in-memory SQLite database migrates in milliseconds and leaves nothing behind.
 */
export async function createQueue(options: { now?: () => number } = {}): Promise<QueueHarness> {
  const handle = openDatabase(':memory:');
  await migrate(handle.db, { migrationsFolder: MIGRATIONS_FOLDER });

  return {
    queue: new SqliteJobQueue({
      db: handle.db,
      ...(options.now === undefined ? {} : { now: options.now }),
    }),
    close: () => {
      handle.close();
    },
  };
}

const TRANSIENT = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY']);

/**
 * Windows does not release a file handle the instant SQLite closes it, so an
 * immediate `rm` of a WAL-mode database races the close and fails with EBUSY.
 * Retry briefly rather than leaving temp directories behind.
 */
export async function removeWithRetry(path: string, attempts = 10): Promise<void> {
  for (let attempt = 0; attempt < attempts; attempt += 1) {
    try {
      await rm(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 50 });
      return;
    } catch (error) {
      const code = (error as NodeJS.ErrnoException).code ?? '';
      if (!TRANSIENT.has(code) || attempt === attempts - 1) throw error;
      await new Promise((resolvePromise) => setTimeout(resolvePromise, 60));
    }
  }
}
