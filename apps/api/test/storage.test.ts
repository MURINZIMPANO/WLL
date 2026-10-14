import { readFile } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';

import { StorageError } from '@lyriclens/shared';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { LocalStorageDriver } from '../src/storage/local-driver.js';

describe('LocalStorageDriver', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'lyriclens-storage-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 50 });
  });

  describe('round trip', () => {
    it('stores and reads bytes back unchanged', async () => {
      const driver = new LocalStorageDriver({ root });
      const body = new TextEncoder().encode('the quick brown fox');

      const meta = await driver.put({ key: 'covers/ab/abc.mp3', body, contentType: 'audio/mpeg' });
      expect(meta.bytes).toBe(body.byteLength);
      expect(meta.encrypted).toBe(false);

      expect(await driver.get('covers/ab/abc.mp3')).toEqual(body);
    });

    it('stores binary data byte for byte', async () => {
      const driver = new LocalStorageDriver({ root });
      // Wrap in Uint8Array: Buffer and Uint8Array are distinct types and
      // toEqual compares constructors.
      const body = new Uint8Array(randomBytes(4096));

      await driver.put({
        key: 'uploads/cd/blob.bin',
        body,
        contentType: 'application/octet-stream',
      });
      expect(await driver.get('uploads/cd/blob.bin')).toEqual(body);
    });

    it('overwrites an existing key', async () => {
      const driver = new LocalStorageDriver({ root });
      await driver.put({
        key: 'a/b/c.txt',
        body: new TextEncoder().encode('one'),
        contentType: 'text/plain',
      });
      await driver.put({
        key: 'a/b/c.txt',
        body: new TextEncoder().encode('two'),
        contentType: 'text/plain',
      });

      expect(new TextDecoder().decode(await driver.get('a/b/c.txt'))).toBe('two');
    });

    it('creates the shard directory on demand', async () => {
      const driver = new LocalStorageDriver({ root });
      await driver.put({
        key: 'deep/nested/path/file.txt',
        body: new Uint8Array([1]),
        contentType: 'text/plain',
      });
      expect(await driver.exists('deep/nested/path/file.txt')).toBe(true);
    });

    it('leaves no partial file behind after a successful write', async () => {
      const driver = new LocalStorageDriver({ root });
      await driver.put({
        key: 'a/b/c.txt',
        body: new TextEncoder().encode('x'),
        contentType: 'text/plain',
      });

      const { readdir } = await import('node:fs/promises');
      const files = await readdir(join(root, 'a', 'b'));
      expect(files).toEqual(['c.txt']);
    });
  });

  describe('encryption at rest', () => {
    const key = randomBytes(32).toString('hex');

    it('reports that encryption is off without a key', () => {
      expect(new LocalStorageDriver({ root }).encryptionEnabled).toBe(false);
    });

    it('reports that encryption is on with a key', () => {
      expect(new LocalStorageDriver({ root, encryptionKeyHex: key }).encryptionEnabled).toBe(true);
    });

    it('rejects a malformed key with an actionable message', () => {
      expect(() => new LocalStorageDriver({ root, encryptionKeyHex: 'too-short' })).toThrow(
        /64 hex characters/,
      );
    });

    it('seals the bytes on disk and decrypts on read', async () => {
      const driver = new LocalStorageDriver({ root, encryptionKeyHex: key });
      const secret = new TextEncoder().encode('uploaded user media that must not sit in plaintext');

      const meta = await driver.put({
        key: 'uploads/ef/secret.bin',
        body: secret,
        contentType: 'application/octet-stream',
        encrypt: true,
      });
      expect(meta.encrypted).toBe(true);

      // The file on disk must not contain the plaintext.
      const onDisk = await readFile(join(root, 'uploads', 'ef', 'secret.bin'));
      expect(onDisk.includes(secret)).toBe(false);
      expect(onDisk.length).toBeGreaterThan(secret.byteLength); // IV + tag overhead

      expect(await driver.get('uploads/ef/secret.bin')).toEqual(secret);
    });

    it('stores two objects under the same key with different ciphertext', async () => {
      const driver = new LocalStorageDriver({ root, encryptionKeyHex: key });
      const body = new TextEncoder().encode('identical plaintext');

      await driver.put({ key: 'uploads/ef/a.bin', body, contentType: 'text/plain', encrypt: true });
      await driver.put({ key: 'uploads/ef/b.bin', body, contentType: 'text/plain', encrypt: true });

      const first = await readFile(join(root, 'uploads', 'ef', 'a.bin'));
      const second = await readFile(join(root, 'uploads', 'ef', 'b.bin'));
      // A fresh IV per object means identical input must not produce identical
      // ciphertext — otherwise the scheme leaks equality.
      expect(first.equals(second)).toBe(false);
    });

    it('fails loudly when read with the wrong key', async () => {
      const writer = new LocalStorageDriver({ root, encryptionKeyHex: key });
      await writer.put({
        key: 'uploads/ef/secret.bin',
        body: new TextEncoder().encode('secret'),
        contentType: 'text/plain',
        encrypt: true,
      });

      const wrongKey = new LocalStorageDriver({
        root,
        encryptionKeyHex: randomBytes(32).toString('hex'),
      });
      await expect(wrongKey.get('uploads/ef/secret.bin')).rejects.toThrow(/decrypt/i);
    });

    it('stores plaintext when encrypt is not requested, even with a key set', async () => {
      const driver = new LocalStorageDriver({ root, encryptionKeyHex: key });
      const body = new TextEncoder().encode('cover art is public, leave it readable');

      const meta = await driver.put({ key: 'covers/ab/x.jpg', body, contentType: 'image/jpeg' });
      expect(meta.encrypted).toBe(false);

      const onDisk = await readFile(join(root, 'covers', 'ab', 'x.jpg'));
      expect(onDisk.includes(body)).toBe(true);
    });

    it('does not claim encryption when no key is configured', async () => {
      const driver = new LocalStorageDriver({ root });
      const meta = await driver.put({
        key: 'uploads/ef/plain.bin',
        body: new Uint8Array([1, 2, 3]),
        contentType: 'text/plain',
        encrypt: true,
      });
      // `encrypt: true` was requested but cannot be honoured, so the metadata
      // says so rather than lying about it.
      expect(meta.encrypted).toBe(false);
    });
  });

  describe('metadata and deletion', () => {
    it('reports head metadata for an existing object', async () => {
      const driver = new LocalStorageDriver({ root });
      await driver.put({ key: 'a/b/c.bin', body: new Uint8Array(10), contentType: 'text/plain' });

      const head = await driver.head('a/b/c.bin');
      expect(head).not.toBeNull();
      expect(head?.bytes).toBe(10);
      expect(head?.key).toBe('a/b/c.bin');
    });

    it('returns null from head for a missing object instead of throwing', async () => {
      expect(await new LocalStorageDriver({ root }).head('nope/x.bin')).toBeNull();
    });

    it('throws a StorageError for a missing get', async () => {
      await expect(new LocalStorageDriver({ root }).get('nope/x.bin')).rejects.toBeInstanceOf(
        StorageError,
      );
    });

    it('deletes an object and reports it gone', async () => {
      const driver = new LocalStorageDriver({ root });
      await driver.put({ key: 'a/b/c.bin', body: new Uint8Array(1), contentType: 'text/plain' });

      await driver.delete('a/b/c.bin');
      expect(await driver.exists('a/b/c.bin')).toBe(false);
    });

    it('deleting a missing key is a no-op', async () => {
      await expect(new LocalStorageDriver({ root }).delete('nope/x.bin')).resolves.toBeUndefined();
    });

    it('prunes the empty shard directory on deleteAndPrune', async () => {
      const driver = new LocalStorageDriver({ root });
      await driver.put({ key: 'a/b/c.bin', body: new Uint8Array(1), contentType: 'text/plain' });

      await driver.deleteAndPrune('a/b/c.bin');
      expect(await driver.exists('a/b/c.bin')).toBe(false);
    });

    it('never returns a public URL', () => {
      expect(new LocalStorageDriver({ root }).publicUrl('a/b/c.bin')).toBeNull();
    });
  });

  describe('path traversal', () => {
    it('refuses a key containing ..', async () => {
      const driver = new LocalStorageDriver({ root });
      await expect(driver.get('../../secrets.txt')).rejects.toThrow(/escapes the root/);
    });

    it('refuses an absolute key', async () => {
      const driver = new LocalStorageDriver({ root });
      await expect(
        driver.put({ key: '/etc/passwd', body: new Uint8Array(1), contentType: 'text/plain' }),
      ).rejects.toThrow(/escapes the root/);
    });

    it('refuses a Windows-style absolute key', async () => {
      const driver = new LocalStorageDriver({ root });
      await expect(driver.get('C:\\Windows\\win.ini')).rejects.toThrow(/escapes the root/);
    });

    it('refuses a traversal hidden mid-path', async () => {
      const driver = new LocalStorageDriver({ root });
      await expect(driver.exists('a/../../b.txt')).rejects.toThrow(/escapes the root/);
    });
  });
});
