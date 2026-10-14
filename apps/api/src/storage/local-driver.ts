import { StorageError, type PutObjectInput, type StorageDriver, type StoredObjectMeta } from '@lyriclens/shared';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { mkdir, readFile, rename, rm, stat, writeFile } from 'node:fs/promises';
import { dirname, join, normalize, resolve, sep } from 'node:path';

/**
 * Local filesystem storage driver.
 *
 * Layout on disk mirrors the key path, which keeps debugging trivial
 * (`storage/uploads/ab/abc123.mp4`). Swapping in S3/R2 means implementing the
 * same `StorageDriver` interface — nothing above this file changes.
 *
 * ENCRYPTION AT REST: when a media key is configured, uploaded bytes are
 * sealed with AES-256-GCM before they touch the disk. The random IV is
 * prepended to the ciphertext and the auth tag appended, so `get()` is
 * self-contained. In development without a key, objects are stored in plaintext
 * and `encrypted: false` says so honestly rather than pretending.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const ALGORITHM = 'aes-256-gcm';

export interface LocalStorageOptions {
  root: string;
  /** 64 hex characters. When absent, encryption is disabled and flagged as such. */
  encryptionKeyHex?: string | undefined;
}

export class LocalStorageDriver implements StorageDriver {
  readonly driver = 'local' as const;
  readonly #root: string;
  readonly #key: Buffer | null;

  constructor(options: LocalStorageOptions) {
    this.#root = resolve(options.root);

    if (options.encryptionKeyHex === undefined || options.encryptionKeyHex.trim() === '') {
      this.#key = null;
    } else {
      const key = Buffer.from(options.encryptionKeyHex.trim(), 'hex');
      if (key.length !== 32) {
        throw new StorageError(
          'MEDIA_ENCRYPTION_KEY must be 64 hex characters (32 bytes). Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"',
        );
      }
      this.#key = key;
    }
  }

  get encryptionEnabled(): boolean {
    return this.#key !== null;
  }

  #pathFor(key: string): string {
    // Reject traversal outright rather than relying on normalisation alone.
    if (key.includes('..') || key.startsWith('/') || key.startsWith('\\')) {
      throw new StorageError(`Refusing to access a storage key that escapes the root: ${key}`);
    }

    const target = resolve(this.#root, normalize(key));
    if (target !== this.#root && !target.startsWith(this.#root + sep)) {
      throw new StorageError(`Refusing to access a storage key that escapes the root: ${key}`);
    }
    return target;
  }

  async put(input: PutObjectInput): Promise<StoredObjectMeta> {
    const target = this.#pathFor(input.key);
    const shouldEncrypt = (input.encrypt ?? false) && this.#key !== null;

    let payload: Buffer;
    if (shouldEncrypt && this.#key !== null) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv(ALGORITHM, this.#key, iv);
      const body = Buffer.concat([cipher.update(input.body), cipher.final()]);
      payload = Buffer.concat([iv, body, cipher.getAuthTag()]);
    } else {
      payload = Buffer.from(input.body);
    }

    await mkdir(dirname(target), { recursive: true });

    // Write to a temp file then rename: a crash mid-write must never leave a
    // half-written object that later reads as corrupt.
    const temporary = `${target}.${randomBytes(6).toString('hex')}.part`;
    await writeFile(temporary, payload);
    await rename(temporary, target);

    return {
      key: input.key,
      bytes: input.body.byteLength,
      contentType: input.contentType,
      encrypted: shouldEncrypt,
      createdAtMs: Date.now(),
    };
  }

  async get(key: string): Promise<Uint8Array> {
    const target = this.#pathFor(key);

    let raw: Buffer;
    try {
      raw = await readFile(target);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        throw new StorageError(`No stored object at key '${key}'`, error);
      }
      throw new StorageError(`Failed to read object '${key}'`, error);
    }

    if (this.#key === null || raw.length <= IV_BYTES + TAG_BYTES) {
      // No key configured, or too short to be a sealed payload.
      return new Uint8Array(raw);
    }

    const iv = raw.subarray(0, IV_BYTES);
    const tag = raw.subarray(raw.length - TAG_BYTES);
    const body = raw.subarray(IV_BYTES, raw.length - TAG_BYTES);

    try {
      const decipher = createDecipheriv(ALGORITHM, this.#key, iv);
      decipher.setAuthTag(tag);
      return new Uint8Array(Buffer.concat([decipher.update(body), decipher.final()]));
    } catch (error) {
      throw new StorageError(`Failed to decrypt object '${key}' — wrong MEDIA_ENCRYPTION_KEY?`, error);
    }
  }

  async head(key: string): Promise<StoredObjectMeta | null> {
    // Validate the key *outside* the try: a path-traversal attempt must throw,
    // not be silently reported as "no such object".
    const target = this.#pathFor(key);

    try {
      const info = await stat(target);
      return {
        key,
        bytes: info.size,
        contentType: 'application/octet-stream',
        // Encrypted payloads carry a 28-byte header/footer overhead.
        encrypted: this.#key !== null && info.size > IV_BYTES + TAG_BYTES,
        createdAtMs: info.mtimeMs,
      };
    } catch {
      return null;
    }
  }

  async delete(key: string): Promise<void> {
    await rm(this.#pathFor(key), { force: true });
  }

  /**
   * Objects may be encrypted user uploads, so they are never served from a
   * public URL. The API streams them to authorised callers instead.
   */
  publicUrl(_key: string): string | null {
    return null;
  }

  async exists(key: string): Promise<boolean> {
    // Same reasoning as `head`: validation errors propagate, only "absent"
    // resolves to false.
    const target = this.#pathFor(key);
    try {
      await stat(target);
      return true;
    } catch {
      return false;
    }
  }

  /** Remove a key and the now-empty shard directory above it. */
  async deleteAndPrune(key: string): Promise<void> {
    await this.delete(key);
    const shard = dirname(this.#pathFor(key));
    if (shard.startsWith(this.#root + sep)) {
      await rm(shard, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  /** Absolute path for a key, for handing to an ffmpeg subprocess. */
  resolvePath(key: string): string {
    return this.#pathFor(key);
  }

  rootPath(): string {
    return join(this.#root);
  }
}
