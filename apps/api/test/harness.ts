import { rmSync } from 'node:fs';
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
  addCleanupBackstop(storageRoot);

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
      // Only safe once the directory is actually gone: the backstop must not
      // keep a second removal queued behind a first one that already ran.
      removeCleanupBackstop(storageRoot);
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

/**
 * Error codes that mean "the OS still has a handle open", not "removal is
 * impossible". Everything else is a real failure and must not be retried.
 */
const TRANSIENT = new Set(['EBUSY', 'EPERM', 'ENOTEMPTY']);

/**
 * Upper bound on how long cleanup waits for the OS to let go of the files.
 *
 * Generous on purpose: the wait costs nothing when the handle is already free
 * (the poll returns on the first attempt), so a large ceiling costs nothing in
 * the happy path while making the slow path reliable. Measured worst case over
 * ten consecutive harnesses was 12.7s; 45s leaves ample headroom for a loaded
 * machine without hiding a genuinely leaked handle.
 */
export const CLEANUP_TIMEOUT_MS = 45_000;
const CLEANUP_POLL_MS = 100;

/**
 * Timeout for any `beforeAll`/`afterAll` hook that creates or destroys a
 * harness. Derived from the cleanup budget rather than written out by hand,
 * because a hook timeout that is not strictly greater than the work it wraps is
 * indistinguishable from a hang — and a hook timeout reports "hook timed out",
 * which tells you nothing about the SQLite handle that was actually stuck.
 */
export const HARNESS_HOOK_TIMEOUT_MS = CLEANUP_TIMEOUT_MS + 30_000;

/**
 * Remove a directory that a SQLite client has just released.
 *
 * Why this needs to wait rather than retry a fixed few times: libSQL's native
 * binding does not close the database file handle on the calling thread. It
 * hands the close to a background I/O thread, so `client.close()` returns
 * while Windows still holds `test.db-wal`, `test.db-shm` and `test.db` open.
 * Measured release times on this machine ranged from 0.5s to 12s, and longer
 * when three suites migrate concurrently — well past any fixed retry budget.
 *
 * The failure mode that motivated this is nasty: every assertion passed, and
 * the suite still went red on `EBUSY: unlink test.db-wal` in `afterAll`. It
 * looked like a flaky environment and behaved like a broken product.
 */
export async function removeWithRetry(
  path: string,
  timeoutMs: number = CLEANUP_TIMEOUT_MS,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let lastError!: NodeJS.ErrnoException;

  for (;;) {
    try {
      // `maxRetries: 0` on purpose: this function owns the retry loop, and
      // nesting Node's own backoff inside it makes the real timeout
      // unpredictable.
      await rm(path, { recursive: true, force: true, maxRetries: 0 });
      return;
    } catch (error) {
      const errno = error as NodeJS.ErrnoException;
      if (!TRANSIENT.has(errno.code ?? '')) throw error;
      lastError = errno;
      if (Date.now() >= deadline) break;
      await new Promise((done) => setTimeout(done, CLEANUP_POLL_MS));
    }
  }

  throw new Error(
    `Could not remove ${path} after ${timeoutMs}ms: ${lastError.code} ${lastError.message}\n` +
      'A SQLite handle is still open on a file inside it, so this is a leaked ' +
      'connection in the code under test rather than a slow disk. If the suite ' +
      'passed, the directory is still removed when the worker exits.',
  );
}

/**
 * Last-resort removal for a directory whose cleanup did not finish.
 *
 * Registered as soon as the temp directory exists and removed once cleanup
 * succeeds. By the time the worker exits every handle it held is closed, so a
 * synchronous retry here succeeds where the async wait above could not — which
 * is what keeps a dozen failed runs from littering `%TEMP%` with databases.
 */
const cleanupBackstops = new Map<string, () => void>();

function addCleanupBackstop(path: string): void {
  if (cleanupBackstops.has(path)) return;

  const onExit = () => {
    // `rmSync` rather than anything async: there is no event loop left to run
    // a promise on during `exit`.
    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        rmSync(path, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
        return;
      } catch {
        // The OS can still be draining the handle; give it another moment.
      }
    }
  };

  cleanupBackstops.set(path, onExit);
  process.on('exit', onExit);
}

function removeCleanupBackstop(path: string): void {
  const onExit = cleanupBackstops.get(path);
  if (onExit === undefined) return;
  cleanupBackstops.delete(path);
  process.off('exit', onExit);
}
