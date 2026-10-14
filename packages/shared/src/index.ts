/**
 * `@lyriclens/shared` — the contracts every other package compiles against.
 *
 * Semver policy: this package is versioned with the monorepo. Additive changes
 * are minor; anything that changes an exported signature is major and must ship
 * behind an adapter (see `providers.ts` for the stability contract).
 */

export * from './errors.js';
export * from './result.js';
export * from './time.js';
export * from './lyrics.js';
export * from './subtitles.js';
export * from './lookup.js';
export * from './domain.js';
export * from './providers.js';
export * from './feature-flags.js';
export * from './env.js';
export * from './storage.js';
export * from './queue.js';
