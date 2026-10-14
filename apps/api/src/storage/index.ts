import type { Env, StorageDriver } from '@lyriclens/shared';

import { LocalStorageDriver } from './local-driver.js';

export { LocalStorageDriver };

/** Selects only the keys the driver needs, preserving Env's optionality. */
type StorageEnv = Pick<
  Env,
  'STORAGE_DRIVER' | 'STORAGE_LOCAL_PATH' | 'MEDIA_ENCRYPTION_KEY' | 'S3_ENDPOINT' | 'S3_BUCKET'
>;

/**
 * Storage factory.
 *
 * `local` is the dev default and needs no credentials. `s3` is wired for
 * Cloudflare R2 / AWS S3 and is selected purely by `STORAGE_DRIVER`; the
 * concrete S3 driver lands with the export phase, and until then selecting it
 * fails loudly at boot rather than silently writing nothing.
 */
export function createStorage(env: StorageEnv): StorageDriver {
  if (env.STORAGE_DRIVER === 'local') {
    return new LocalStorageDriver({
      root: env.STORAGE_LOCAL_PATH,
      encryptionKeyHex: env.MEDIA_ENCRYPTION_KEY,
    });
  }

  throw new Error(
    `STORAGE_DRIVER=s3 is configured (bucket=${env.S3_BUCKET ?? 'unset'}) but the S3 driver is not implemented in Phase 0. ` +
      'Set STORAGE_DRIVER=local, or implement StorageDriver in apps/api/src/storage/s3-driver.ts.',
  );
}
