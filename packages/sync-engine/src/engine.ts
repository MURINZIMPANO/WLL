import {
  findLineIndexAt,
  findWordIndexAt,
  toErrorEnvelope,
  type ErrorEnvelope,
  type LyricsDoc,
  type NowPlayingProvider,
  type TrackIdentity,
} from '@lyriclens/shared';

import { systemClock, type Clock } from './clock.js';
import {
  interpolate,
  isImplausibleStep,
  isStructurallyValid,
  measureDrift,
  shouldCorrect,
} from './drift.js';
import { createInitialState, reduce } from './machine.js';
import {
  DEFAULT_DRIFT_TOLERANCE_MS,
  DEFAULT_MAX_STEP_MS,
  type EngineSource,
  type PositionSample,
  type SyncEvent,
  type SyncFrame,
  type SyncSnapshot,
  type SyncState,
} from './types.js';

/**
 * The one synchronisation engine.
 *
 * The desktop overlay, the PWA player and offline replay all drive this class;
 * they differ only in which {@link EngineSource} they hand it. That is what
 * makes "under 300ms drift" a single testable guarantee rather than three
 * separate implementations.
 *
 * Two read paths, deliberately:
 *  - `subscribe()` fires only when the *state* changes (track, lyrics, error).
 *  - `read()` computes the current frame and is meant to be called from
 *    `requestAnimationFrame`. It is a pure read — it never mutates, allocates
 *    two small objects and is safe to call 60 times a second.
 */
export class SyncEngine {
  readonly #source: EngineSource;
  readonly #clock: Clock;
  readonly #driftToleranceMs: number;
  readonly #maxStepMs: number;
  readonly #pollIntervalMs: number;

  #state: SyncState = createInitialState();
  #anchor: { positionMs: number; monotonicMs: number; playing: boolean } | null = null;
  #offsetMs = 0;
  #durationMs: number | null = null;
  #playing = false;

  /** Replay / A-B loop scrub: overrides the source until cleared. */
  #positionOverrideMs: number | null = null;

  #lastDriftMs = 0;
  #correctionCount = 0;
  #updatedAtMs = 0;

  #listeners = new Set<(snapshot: SyncSnapshot) => void>();
  #unsubscribeSource: (() => void) | null = null;
  #timer: ReturnType<typeof setInterval> | null = null;
  #running = false;

  constructor(options: {
    source: EngineSource;
    clock?: Clock;
    driftToleranceMs?: number;
    maxStepMs?: number;
    /** 0 disables background polling and relies purely on push notifications. */
    pollIntervalMs?: number;
  }) {
    this.#source = options.source;
    this.#clock = options.clock ?? systemClock;
    this.#driftToleranceMs = options.driftToleranceMs ?? DEFAULT_DRIFT_TOLERANCE_MS;
    this.#maxStepMs = options.maxStepMs ?? DEFAULT_MAX_STEP_MS;
    this.#pollIntervalMs = options.pollIntervalMs ?? 500;
  }

  // --- lifecycle ---------------------------------------------------------

  start(): void {
    if (this.#running) return;
    this.#running = true;
    this.#dispatch({ type: 'START' });

    this.#unsubscribeSource =
      this.#source.subscribe?.(() => {
        this.poll();
      }) ?? null;

    if (this.#pollIntervalMs > 0) {
      this.#timer = setInterval(() => {
        this.poll();
      }, this.#pollIntervalMs);
      // Never hold a Node process open just for the sync poller.
      (this.#timer as { unref?: () => void }).unref?.();
    }

    this.poll();
  }

  stop(): void {
    if (!this.#running) return;
    this.#running = false;
    this.#unsubscribeSource?.();
    this.#unsubscribeSource = null;
    if (this.#timer !== null) {
      clearInterval(this.#timer);
      this.#timer = null;
    }
  }

  /** Stop and detach every listener. The engine is unusable afterwards. */
  dispose(): void {
    this.stop();
    this.#listeners.clear();
  }

  get running(): boolean {
    return this.#running;
  }

  // --- sampling ----------------------------------------------------------

  /** Pull one sample from the source and fold it into the state. */
  poll(): void {
    const sample = this.#source.sample();
    if (sample === null) return;
    this.applySample(sample);
  }

  /**
   * Fold a position reading in.
   *
   * Public because the desktop overlay receives SMTC change notifications that
   * arrive faster than its poll interval, and because replay drives the engine
   * from `<audio>` events.
   */
  applySample(sample: PositionSample): void {
    if (!isStructurallyValid(sample)) return;

    const now = this.#clock.now();

    // Detect a track change before touching the anchor, so the previous
    // position cannot leak into the new track.
    if (sample.trackKey !== null && sample.trackKey !== this.#state.trackKey) {
      const event: SyncEvent = {
        type: this.#state.trackKey === null ? 'TRACK_DETECTED' : 'TRACK_CHANGED',
        sample,
      };
      this.#dispatch(event);
      this.#anchor = { positionMs: sample.positionMs, monotonicMs: now, playing: sample.playing };
      this.#lastDriftMs = 0;
    } else {
      const anchor = this.#anchor;
      if (anchor === null) {
        this.#anchor = { positionMs: sample.positionMs, monotonicMs: now, playing: sample.playing };
      } else if (
        sample.seeked !== true &&
        isImplausibleStep(anchor, sample.positionMs, now, this.#maxStepMs)
      ) {
        // An undeclared jump is a provider glitch: keep the old anchor and wait
        // for the next reading rather than teleporting the lyrics.
        return;
      } else {
        const drift = measureDrift(anchor, sample.positionMs, now);
        this.#anchor = { positionMs: sample.positionMs, monotonicMs: now, playing: sample.playing };
        this.#lastDriftMs = drift;
        if (shouldCorrect(drift, this.#driftToleranceMs)) this.#correctionCount += 1;
        this.#dispatch({ type: 'TRANSPORT_CHANGED', playing: sample.playing });
      }
    }

    this.#durationMs = sample.durationMs;
    this.#playing = sample.playing;
    this.#updatedAtMs = now;
    // Deliberately no notify(): position changes are read via `read()` from the
    // animation loop. Notifying here would double the render rate of every
    // consumer for no benefit.
  }

  // --- lyrics ------------------------------------------------------------

  setLyrics(doc: LyricsDoc): void {
    this.#offsetMs = doc.offsetMs;
    this.#dispatch({ type: 'LYRICS_LOADED', doc });
  }

  clearLyrics(): void {
    this.#dispatch({ type: 'NO_LYRICS_AVAILABLE' });
  }

  /**
   * User nudge, in milliseconds. Positive delays the highlight (the lyrics feel
   * "early"); negative brings them forward. Applied on top of `doc.offsetMs`,
   * never baked into the document, so it stays reversible.
   */
  setOffset(offsetMs: number): void {
    if (!Number.isFinite(offsetMs)) return;
    this.#offsetMs = Math.round(offsetMs);
    this.#notify();
  }

  get offsetMs(): number {
    return this.#offsetMs;
  }

  // --- transport ---------------------------------------------------------

  /**
   * Force a position without telling the source (replay scrubbing, A-B loop).
   * Cleared automatically by {@link clearPositionOverride}.
   */
  seekTo(positionMs: number): void {
    this.#positionOverrideMs = Math.max(0, positionMs);
    this.#notify();
  }

  clearPositionOverride(): void {
    if (this.#positionOverrideMs === null) return;
    this.#positionOverrideMs = null;
    this.#notify();
  }

  reportError(err: unknown): void {
    const envelope: ErrorEnvelope = toErrorEnvelope(err);
    this.#dispatch({ type: 'ERROR', error: envelope });
  }

  setOffline(offline: boolean): void {
    this.#dispatch({ type: 'OFFLINE', offline });
  }

  reset(): void {
    this.#anchor = null;
    this.#positionOverrideMs = null;
    this.#lastDriftMs = 0;
    this.#correctionCount = 0;
    this.#dispatch({ type: 'RESET' });
  }

  // --- reads -------------------------------------------------------------

  /** Current frame. Pure — safe to call from an animation loop. */
  read(nowMs?: number): SyncSnapshot {
    const now = nowMs ?? this.#clock.now();
    const positionMs =
      this.#positionOverrideMs ?? (this.#anchor === null ? 0 : interpolate(this.#anchor, now));

    const lyricPositionMs = Math.max(0, positionMs + this.#offsetMs);
    const lyrics = this.#state.lyrics;
    const synced = lyrics !== null && lyrics.synced;

    const activeLineIndex = synced ? findLineIndexAt(lyrics.lines, lyricPositionMs) : -1;
    const activeLine = activeLineIndex >= 0 ? (lyrics?.lines[activeLineIndex] ?? null) : null;
    const activeWordIndex =
      activeLine !== null && activeLine.words.length > 0
        ? findWordIndexAt(activeLine.words, lyricPositionMs)
        : -1;

    const frame: SyncFrame = {
      positionMs,
      durationMs: this.#durationMs,
      playing: this.#playing,
      activeLineIndex,
      activeWordIndex,
      activeLineText: activeLine?.text ?? '',
      lyricPositionMs,
    };

    return {
      ...this.#state,
      frame,
      offsetMs: this.#offsetMs,
      lastDriftMs: this.#lastDriftMs,
      correctionCount: this.#correctionCount,
      updatedAtMs: this.#updatedAtMs,
    };
  }

  subscribe(listener: (snapshot: SyncSnapshot) => void): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  // --- internals ---------------------------------------------------------

  #dispatch(event: SyncEvent): void {
    const next = reduce(this.#state, event);
    if (next === this.#state) return;
    this.#state = next;
    this.#notify();
  }

  #notify(): void {
    if (this.#listeners.size === 0) return;
    const snapshot = this.read();
    for (const listener of this.#listeners) listener(snapshot);
  }
}

/** Adapt a {@link NowPlayingProvider} (SMTC / NowPlaying / MPRIS / Spotify) to the engine. */
export function nowPlayingSource(provider: NowPlayingProvider): EngineSource {
  return {
    id: provider.id,
    sample(): PositionSample | null {
      const snapshot = provider.getSnapshot();
      if (snapshot === null) return null;
      return {
        positionMs: snapshot.positionMs,
        playing: snapshot.playing,
        durationMs: snapshot.durationMs,
        track: snapshot.track as TrackIdentity,
        source: snapshot.source,
        trackKey: trackKeyOf(snapshot.track),
        seeked: false,
      };
    },
    subscribe(listener: () => void): () => void {
      return provider.subscribe(() => {
        listener();
      });
    },
  };
}

/**
 * Structural view of `<audio>`/`<video>`.
 *
 * Declared here rather than using `HTMLMediaElement` so this package needs no
 * DOM lib and stays consumable from Node (the API, tests, workers). A real
 * `HTMLMediaElement` satisfies it structurally.
 */
export interface MediaElementLike {
  readonly currentTime: number;
  readonly duration: number;
  readonly paused: boolean;
  readonly ended: boolean;
}

/**
 * Adapt a local media element — the replay and Scene Player path, where
 * LyricLens is the one playing the media and therefore knows the exact
 * position rather than inferring it.
 */
export function mediaElementSource(
  element: MediaElementLike,
  track: TrackIdentity | null,
  source: PositionSample['source'] = 'manual_search',
): EngineSource {
  const key = trackKeyOf(track);
  return {
    id: 'media-element',
    sample(): PositionSample {
      return {
        positionMs: Math.round(element.currentTime * 1000),
        playing: !element.paused && !element.ended,
        durationMs: Number.isFinite(element.duration) ? Math.round(element.duration * 1000) : null,
        track,
        source,
        trackKey: key,
        seeked: false,
      };
    },
  };
}

/**
 * Adapt an arbitrary getter — used by the Tauri overlay, where the Rust side
 * pushes the SMTC position over a channel rather than exposing an object.
 */
export function manualSource(id: string, read: () => PositionSample | null): EngineSource {
  return { id, sample: read };
}

function trackKeyOf(track: TrackIdentity | null): string | null {
  if (track === null) return null;
  return `${track.artist.trim().toLowerCase()}::${track.title.trim().toLowerCase()}`;
}
