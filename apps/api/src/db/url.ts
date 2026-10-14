import { dirname, isAbsolute, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * Database URL resolution.
 *
 * A `file:` URL is resolved relative to the **repository root**, never the
 * process working directory. Without this, `pnpm db:migrate` (cwd = apps/api)
 * and `pnpm dev` (cwd = repo root via turbo) would silently create two
 * different databases — a genuinely nasty class of "my data vanished" bug.
 *
 * Remote URLs (`libsql://`, `https://`, `postgres://`) pass through untouched.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
/** apps/api/src/db -> repo root */
export const REPO_ROOT = resolve(HERE, '../../../..');

export function resolveDatabaseUrl(url: string, baseDir: string = REPO_ROOT): string {
  if (!url.startsWith('file:')) return url;

  const raw = url.slice('file:'.length);
  if (raw === ':memory:' || raw === '') return url;

  const absolute = isAbsolute(raw) ? raw : resolve(baseDir, raw);
  // libSQL wants forward slashes, including the Windows drive letter.
  return `file:${absolute.replace(/\\/g, '/')}`;
}

/** The filesystem path a `file:` URL points at, or null for remote URLs. */
export function localPathFor(url: string, baseDir: string = REPO_ROOT): string | null {
  if (!url.startsWith('file:')) return null;
  const raw = url.slice('file:'.length);
  if (raw === ':memory:' || raw === '') return null;
  return isAbsolute(raw) ? raw : resolve(baseDir, raw);
}
