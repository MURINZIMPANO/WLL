import type { ErrorEnvelope, LyricsDoc, SessionSource, TrackIdentity } from '@lyriclens/shared';

/**
 * Sync engine vocabulary.
 *
 * `@lyriclens/sync-engine` is consumed by the desktop overlay, the PWA player
 * and offline replay, so this file is semver-stable public API. Additive changes
 * only; anything else needs an adapter.
 */

export const SYNC_STATUSES = ['idle', 'detecting', 'fetching', 'synced', 'error'] as const;
export type SyncStatus = (typeof SYNC_STATUSES)[number];

export type SyncEvent =
  | { type: 'START' }
  | { type: 'TRACK_DETECTED'; sample: PositionSample }
  | { type: 'TRACK_CHANGED'; sample: PositionSample }
  | { type: 'LYRICS_LOADED'; doc: LyricsDoc }
  | { type: 'NO_LYRICS_AVAILABLE' }
  | { type: 'TRANSPORT_CHANGED'; playing: boolean }
  | { type: 'SEEK'; positionMs: number }
  | { type: 'OFFLINE'; offline: boolean }
  | { type: 'ERROR'; error: ErrorEnvelope }
  | { type: 'RESET' };

export type SyncEventType = SyncEvent['type'];

/** One reading of "what and where are we", from any provider or a local player. */
export interface PositionSample {
  positionMs: number;
  playing: boolean;
  durationMs: number | null;
  track: TrackIdentity | null;
  source: SessionSource;
  /** Stable identity used to detect a track change. */
  trackKey: string | null;
  /**
   * The provider tells us this jump was a deliberate user seek. Without it a
   * large jump is indistinguishable from a glitch and gets rejected — which
   * would make seeking feel broken.
   */
  seeked?: boolean;
}

/**
 * Where the engine gets its position from. Implemented by the OS media-session
 * adapters, the Spotify adapter and the local `<audio>` element used by replay.
 */
export interface EngineSource {
  readonly id: string;
  sample(): PositionSample | null;
  /** Optional push notification that a new sample is available. */
  subscribe?(listener: () => void): () => void;
}

export interface SyncState {
  status: SyncStatus;
  track: TrackIdentity | null;
  trackKey: string | null;
  source: SessionSource | null;
  lyrics: LyricsDoc | null;
  lastError: ErrorEnvelope | null;
  /** True when lyrics are loaded but carry no timings. */
  unsynced: boolean;
  offline: boolean;
}

/** Per-frame view. Cheap to compute — safe to call from `requestAnimationFrame`. */
export interface SyncFrame {
  positionMs: number;
  durationMs: number | null;
  playing: boolean;
  activeLineIndex: number;
  activeWordIndex: number;
  activeLineText: string;
  /** Position after the user's per-track offset nudge, for lyric lookup. */
  lyricPositionMs: number;
}

/** State snapshot, emitted only when something meaningful changes. */
export interface SyncSnapshot extends SyncState {
  frame: SyncFrame;
  /** Per-user offset applied on top of the document. */
  offsetMs: number;
  /** |interpolated - reported| at the most recent sample. */
  lastDriftMs: number;
  /** Number of hard re-anchors performed; a climbing count means a bad source. */
  correctionCount: number;
  updatedAtMs: number;
}

export interface SyncEngineOptions {
  source: EngineSource;
  clock?: import('./clock.js').Clock;
  /**
   * Re-anchor silently below this, hard-correct above it. The product
   * requirement is that visible drift never exceeds 300ms; the default leaves
   * comfortable headroom while ignoring normal provider jitter.
   */
  driftToleranceMs?: number;
  /** Reject a position sample that is wildly out of line with the last one. */
  maxStepMs?: number;
}

export const DEFAULT_DRIFT_TOLERANCE_MS = 120;
export const DEFAULT_MAX_STEP_MS = 5_000;
