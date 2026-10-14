import { spawn } from 'node:child_process';
import { existsSync, writeFileSync } from 'node:fs';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

import { CLEANUP_TIMEOUT_MS, createHarness, removeWithRetry } from './harness.js';

/**
 * Regression tests for temp-directory cleanup.
 *
 * These exist because the API suite used to go red intermittently: every
 * assertion passed and `afterAll` then failed with
 * `EBUSY: resource busy or locked, unlink test.db-wal`. libSQL closes the
 * database handle on a background I/O thread, so the directory outlives
 * `client.close()` by seconds.
 *
 * Reproducing that needs a handle that actually blocks deletion. libuv (and so
 * Node itself) opens files with FILE_SHARE_DELETE, so a handle from this process
 * is deleted straight out from under it and proves nothing. The tests below open
 * the file with FileShare.None from a child process, which is what a native
 * SQLite handle looks like to Windows.
 */

const isWindows = process.platform === 'win32';

/**
 * Holds `file` open with no sharing at all, releasing it after `holdMs`.
 *
 * On Windows that makes the file undeletable for the duration, which is exactly
 * the state a closing SQLite handle puts the OS in. On Linux an open file is
 * always unlinkable, so there is nothing to wait for and the test is skipped.
 *
 * `heldMarker` is written only once the handle is genuinely taken, because a
 * cold PowerShell start takes long enough that a fixed sleep would race it —
 * and a test that never actually blocks deletion proves nothing.
 */
function holdFileExclusively(file: string, heldMarker: string, holdMs: number): () => void {
  const quote = (value: string) => `'${value.replace(/'/g, "''")}'`;
  const script = [
    `$f = [System.IO.File]::Open(${quote(file)}, 'Open', 'ReadWrite', 'None')`,
    `New-Item -ItemType File -Path ${quote(heldMarker)} -Force | Out-Null`,
    `Start-Sleep -Milliseconds ${holdMs}`,
    `$f.Dispose()`,
    `Remove-Item -Path ${quote(heldMarker)} -Force -ErrorAction SilentlyContinue`,
  ].join('; ');

  const child = spawn('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], {
    stdio: 'ignore',
    windowsHide: true,
  });
  return () => {
    child.kill();
  };
}

async function waitFor(predicate: () => boolean, timeoutMs: number): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (predicate()) return true;
    await new Promise((done) => setTimeout(done, 50));
  }
  return false;
}

describe('temp directory cleanup', () => {
  it(
    'removes a directory nothing is holding open',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'lyriclens-cleanup-'));
      writeFileSync(join(root, 'file.txt'), 'content');

      await removeWithRetry(root);

      expect(existsSync(root)).toBe(false);
    },
    CLEANUP_TIMEOUT_MS,
  );

  it(
    'removes a directory that was already deleted',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'lyriclens-cleanup-'));

      await removeWithRetry(root);
      await expect(removeWithRetry(root)).resolves.toBeUndefined();
    },
    CLEANUP_TIMEOUT_MS,
  );

  // The test that matters: a fixed short retry budget loses this race, which is
  // how the suite started failing.
  it.skipIf(!isWindows)(
    'waits for a handle that another process still holds',
    async () => {
      const root = await mkdtemp(join(tmpdir(), 'lyriclens-cleanup-'));
      const file = join(root, 'test.db');
      const marker = join(root, 'held');
      writeFileSync(file, 'x');
      const release = holdFileExclusively(file, marker, 3_000);

      try {
        expect(await waitFor(() => existsSync(marker), 20_000)).toBe(true);

        // Prove the lock is real: a single immediate delete must fail. If this
        // ever passes, the test has stopped testing anything.
        await expect(rm(file, { force: true, maxRetries: 0 })).rejects.toMatchObject({
          code: expect.stringMatching(/EBUSY|EPERM/),
        });

        const startedAt = Date.now();
        await removeWithRetry(file);

        expect(Date.now() - startedAt).toBeGreaterThan(500);
        expect(existsSync(file)).toBe(false);
      } finally {
        release();
        await rm(root, { recursive: true, force: true });
      }
    },
    CLEANUP_TIMEOUT_MS + 30_000,
  );

  // The other half of the original failure: the wait must not be so long that
  // it outlasts the hook timeout wrapping it, which turns a diagnosable
  // "could not remove" into an opaque "hook timed out".
  it('exposes a hook timeout comfortably longer than the cleanup budget', async () => {
    const { HARNESS_HOOK_TIMEOUT_MS } = await import('./harness.js');
    expect(HARNESS_HOOK_TIMEOUT_MS).toBeGreaterThan(CLEANUP_TIMEOUT_MS);
  });

  it(
    'leaves no directory behind after a harness is cleaned up',
    async () => {
      const harness = await createHarness();
      await harness.app.server.ready();

      expect(existsSync(harness.storageRoot)).toBe(true);

      await harness.cleanup();

      expect(existsSync(harness.storageRoot)).toBe(false);
    },
    CLEANUP_TIMEOUT_MS + 30_000,
  );
});
