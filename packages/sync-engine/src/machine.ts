import type { LyricsDoc } from '@lyriclens/shared';

import type { PositionSample, SyncEvent, SyncState, SyncStatus } from './types.js';

/**
 * The state machine is a pure function of (state, event). Nothing here touches
 * the clock, the network or the DOM, which is what makes the transition table
 * exhaustively testable — and what lets the engine stay identical across the
 * overlay, the PWA and offline replay.
 */

export const INITIAL_STATE: SyncState = {
  status: 'idle',
  track: null,
  trackKey: null,
  source: null,
  lyrics: null,
  lastError: null,
  unsynced: false,
  offline: false,
};

export function createInitialState(): SyncState {
  return { ...INITIAL_STATE };
}

/**
 * Legal transitions. An event absent for the current status is ignored
 * entirely by `reduce`, because sources legitimately race: a track change can
 * arrive while an error is still being surfaced, and applying a stale lyric
 * document on top of a new track is worse than dropping it.
 */
const TRANSITIONS: Record<SyncStatus, Partial<Record<SyncEvent['type'], SyncStatus>>> = {
  idle: {
    START: 'detecting',
    TRACK_DETECTED: 'fetching',
    ERROR: 'error',
  },
  detecting: {
    TRACK_DETECTED: 'fetching',
    TRACK_CHANGED: 'fetching',
    NO_LYRICS_AVAILABLE: 'synced',
    ERROR: 'error',
    RESET: 'idle',
  },
  fetching: {
    LYRICS_LOADED: 'synced',
    NO_LYRICS_AVAILABLE: 'synced',
    TRACK_CHANGED: 'fetching',
    ERROR: 'error',
    RESET: 'idle',
  },
  synced: {
    TRACK_DETECTED: 'fetching',
    TRACK_CHANGED: 'fetching',
    // Re-confirming "still no lyrics" keeps the status but clears any document.
    NO_LYRICS_AVAILABLE: 'synced',
    ERROR: 'error',
    RESET: 'idle',
  },
  error: {
    START: 'detecting',
    TRACK_DETECTED: 'fetching',
    // A provider that failed once may succeed on retry without the track ever
    // changing, so late lyrics must be able to recover the engine.
    LYRICS_LOADED: 'synced',
    NO_LYRICS_AVAILABLE: 'synced',
    RESET: 'idle',
  },
};

/**
 * Events that only carry data and never change status. They are legal in every
 * state, which keeps the transition table finite without forcing a
 * self-transition entry per row.
 */
const DATA_ONLY_EVENTS: ReadonlySet<SyncEvent['type']> = new Set<SyncEvent['type']>([
  'TRANSPORT_CHANGED',
  'SEEK',
  'OFFLINE',
]);

export function nextStatus(from: SyncStatus, eventType: SyncEvent['type']): SyncStatus {
  return TRANSITIONS[from][eventType] ?? from;
}

export function canTransition(from: SyncStatus, eventType: SyncEvent['type']): boolean {
  return DATA_ONLY_EVENTS.has(eventType) || TRANSITIONS[from][eventType] !== undefined;
}

function sampleFields(sample: PositionSample): Pick<SyncState, 'track' | 'trackKey' | 'source'> {
  return {
    track: sample.track,
    trackKey: sample.trackKey,
    source: sample.source,
  };
}

function applyLyrics(state: SyncState, doc: LyricsDoc): SyncState {
  return { ...state, lyrics: doc, unsynced: !doc.synced, lastError: null };
}

/**
 * Advance the machine. Returns the *same object* when the event is not legal
 * for the current status, or when it carries nothing new — so the engine can
 * use reference equality to decide whether to notify subscribers.
 */
export function reduce(state: SyncState, event: SyncEvent): SyncState {
  if (!canTransition(state.status, event.type)) return state;

  const status = nextStatus(state.status, event.type);
  let next: SyncState = state;

  switch (event.type) {
    case 'TRACK_DETECTED':
    case 'TRACK_CHANGED': {
      // A track change invalidates whatever lyrics we were showing.
      const trackChanged =
        event.sample.trackKey !== null && event.sample.trackKey !== state.trackKey;
      next = {
        ...state,
        ...sampleFields(event.sample),
        ...(trackChanged ? { lyrics: null, unsynced: false } : {}),
      };
      break;
    }

    case 'LYRICS_LOADED': {
      next = applyLyrics(state, event.doc);
      break;
    }

    case 'NO_LYRICS_AVAILABLE': {
      next = { ...state, lyrics: null, unsynced: false };
      break;
    }

    case 'ERROR': {
      next = { ...state, lastError: event.error };
      break;
    }

    case 'OFFLINE': {
      next = { ...state, offline: event.offline };
      break;
    }

    case 'RESET': {
      next = createInitialState();
      break;
    }

    case 'START':
    case 'TRANSPORT_CHANGED':
    case 'SEEK': {
      // Transport events change the position anchor, not the state machine.
      // They appear in the transition table only to keep it total.
      break;
    }
  }

  if (next === state && status === state.status) return state;
  return { ...next, status };
}
export function describeState(state: SyncState): string {
  const parts = [`status=${state.status}`];
  if (state.track !== null) parts.push(`track=${state.track.artist} - ${state.track.title}`);
  if (state.lyrics !== null) parts.push(`lyrics=${state.lyrics.lines.length}`);
  if (state.unsynced) parts.push('unsynced');
  if (state.offline) parts.push('offline');
  return parts.join(' ');
}
