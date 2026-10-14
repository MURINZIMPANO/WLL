/**
 * Storage abstraction.
 *
 * Dev uses the local filesystem; production swaps in S3/R2 behind this exact
 * interface. Nothing above this layer knows which one is in play.
 */

export interface StoredObjectMeta {
  key: string;
  bytes: number;
  contentType: string;
  /** True when the payload is encrypted at rest and must be decrypted on read. */
  encrypted: boolean;
  createdAtMs: number;
}

export interface PutObjectInput {
  key: string;
  body: Uint8Array;
  contentType: string;
  /** Encrypt with the configured media key before writing. */
  encrypt?: boolean;
}

export interface StorageDriver {
  readonly driver: 'local' | 's3';
  put(input: PutObjectInput): Promise<StoredObjectMeta>;
  /** Returns the decrypted bytes. */
  get(key: string): Promise<Uint8Array>;
  head(key: string): Promise<StoredObjectMeta | null>;
  delete(key: string): Promise<void>;
  /** Public URL for direct browser access; null when the object is private. */
  publicUrl(key: string): string | null;
  /** Existence check that never throws. */
  exists(key: string): Promise<boolean>;
}

/**
 * Content-addressed key layout. Sharding by the first two characters of the
 * digest keeps any single directory small, which matters a lot on Windows.
 * Non-alphanumeric characters are collapsed to single dashes rather than
 * one-for-one, so a scope like `Uploads!` yields `uploads`, not `uploads-`.
 */
export function buildStorageKey(scope: string, id: string, extension: string): string {
  const safeScope =
    scope
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'misc';
  const safeExtension = extension.replace(/[^a-z0-9]/gi, '').toLowerCase();
  const shard = id.slice(0, 2).padEnd(2, '0');
  return `${safeScope}/${shard}/${id}${safeExtension === '' ? '' : `.${safeExtension}`}`;
}

const MIME_BY_EXTENSION: Record<string, string> = {
  mp3: 'audio/mpeg',
  m4a: 'audio/mp4',
  aac: 'audio/aac',
  ogg: 'audio/ogg',
  opus: 'audio/opus',
  wav: 'audio/wav',
  flac: 'audio/flac',
  mp4: 'video/mp4',
  webm: 'video/webm',
  mkv: 'video/x-matroska',
  mov: 'video/quicktime',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  srt: 'application/x-subrip',
  vtt: 'text/vtt',
  lrc: 'text/plain',
  txt: 'text/plain',
  csv: 'text/csv',
  json: 'application/json',
};

export function contentTypeFor(filename: string): string {
  const extension = filename.toLowerCase().split('.').pop() ?? '';
  return MIME_BY_EXTENSION[extension] ?? 'application/octet-stream';
}

export const AUDIO_EXTENSIONS = ['mp3', 'm4a', 'aac', 'ogg', 'opus', 'wav', 'flac'] as const;
export const VIDEO_EXTENSIONS = ['mp4', 'webm', 'mkv', 'mov'] as const;
export const SUBTITLE_EXTENSIONS = ['srt', 'vtt'] as const;

export function extensionOf(filename: string): string {
  return filename.toLowerCase().split('.').pop() ?? '';
}

export function isSupportedMediaFile(filename: string): boolean {
  const extension = extensionOf(filename);
  return (
    (AUDIO_EXTENSIONS as readonly string[]).includes(extension) ||
    (VIDEO_EXTENSIONS as readonly string[]).includes(extension)
  );
}

export function isSupportedSubtitleFile(filename: string): boolean {
  return (SUBTITLE_EXTENSIONS as readonly string[]).includes(extensionOf(filename));
}
