/**
 * `@lyriclens/sync-engine` — the single playback/lyrics synchronisation engine.
 *
 * Semver-stable public API (see `types.ts`). Consumers: the Tauri desktop
 * overlay, the PWA player and offline replay.
 */

export {
  SyncEngine,
  nowPlayingSource,
  mediaElementSource,
  manualSource,
  type MediaElementLike,
} from './engine.js';
export { ManualClock, systemClock, type Clock } from './clock.js';
export {
  createInitialState,
  canTransition,
  describeState,
  nextStatus,
  reduce,
  INITIAL_STATE,
} from './machine.js';
export {
  interpolate,
  isImplausibleStep,
  isStructurallyValid,
  measureDrift,
  shouldCorrect,
  type Anchor,
} from './drift.js';
export {
  DEFAULT_DRIFT_TOLERANCE_MS,
  DEFAULT_MAX_STEP_MS,
  SYNC_STATUSES,
  type EngineSource,
  type PositionSample,
  type SyncEvent,
  type SyncEventType,
  type SyncFrame,
  type SyncSnapshot,
  type SyncState,
  type SyncStatus,
} from './types.js';
