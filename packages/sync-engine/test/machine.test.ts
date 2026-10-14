import { describe, expect, it } from 'vitest';

import { normalizeLyricsDoc } from '@lyriclens/shared';

import {
  canTransition,
  createInitialState,
  describeState,
  nextStatus,
  reduce,
} from '../src/machine.js';
import type { SyncState, SyncStatus } from '../src/types.js';

const SAMPLE = {
  positionMs: 0,
  playing: true,
  durationMs: 100_000,
  track: {
    title: 'Song',
    artist: 'Artist',
    album: null,
    durationMs: 100_000,
    isrc: null,
    spotifyId: null,
    musicbrainzId: null,
    coverUrl: null,
  },
  source: 'spotify' as const,
  trackKey: 'artist::song',
};

const doc = (synced = true) => ({
  ...normalizeLyricsDoc({
    provider: 'test',
    lines: [{ startMs: 0, text: 'a' }],
    tailDurationMs: 1_000,
  }),
  synced,
});

function at(status: SyncStatus, extra: Partial<SyncState> = {}): SyncState {
  return { ...createInitialState(), status, ...extra };
}

describe('transition table', () => {
  it('follows the documented happy path', () => {
    let state = createInitialState();
    expect(state.status).toBe('idle');

    state = reduce(state, { type: 'START' });
    expect(state.status).toBe('detecting');

    state = reduce(state, { type: 'TRACK_DETECTED', sample: SAMPLE });
    expect(state.status).toBe('fetching');

    state = reduce(state, { type: 'LYRICS_LOADED', doc: doc() });
    expect(state.status).toBe('synced');
  });

  it('reaches synced when no lyrics exist at all', () => {
    let state = reduce(at('detecting'), { type: 'TRACK_DETECTED', sample: SAMPLE });
    state = reduce(state, { type: 'NO_LYRICS_AVAILABLE' });
    expect(state.status).toBe('synced');
    expect(state.lyrics).toBeNull();
  });

  it('sends any state to error and back to idle', () => {
    for (const status of ['idle', 'detecting', 'fetching', 'synced'] as const) {
      const errored = reduce(at(status), {
        type: 'ERROR',
        error: { error: { code: 'internal_error', message: 'x', retryable: false } },
      });
      expect(errored.status).toBe('error');
      expect(reduce(errored, { type: 'RESET' }).status).toBe('idle');
    }
  });

  it('refetches on a track change while synced', () => {
    const synced = at('synced', { lyrics: doc() });
    const next = reduce(synced, {
      type: 'TRACK_CHANGED',
      sample: { ...SAMPLE, trackKey: 'other::track' },
    });
    expect(next.status).toBe('fetching');
    expect(next.lyrics).toBeNull();
  });

  it('recovers from an error when a new track arrives', () => {
    const errored = at('error');
    expect(reduce(errored, { type: 'TRACK_DETECTED', sample: SAMPLE }).status).toBe('fetching');
    expect(reduce(errored, { type: 'START' }).status).toBe('detecting');
  });

  it('ignores events that are illegal for the current status', () => {
    const idle = at('idle');
    expect(reduce(idle, { type: 'LYRICS_LOADED', doc: doc() })).toBe(idle);
    expect(canTransition('idle', 'LYRICS_LOADED')).toBe(false);
  });

  it('returns the identical object when nothing changed, so callers can skip work', () => {
    const synced = at('synced', { lyrics: doc() });
    expect(reduce(synced, { type: 'TRANSPORT_CHANGED', playing: false })).toBe(synced);
    expect(reduce(synced, { type: 'SEEK', positionMs: 5_000 })).toBe(synced);
  });

  it('exposes the resolved status for a transition', () => {
    expect(nextStatus('detecting', 'TRACK_DETECTED')).toBe('fetching');
    expect(nextStatus('synced', 'OFFLINE')).toBe('synced');
  });
});

describe('reduce — data carried through events', () => {
  it('records the detected track and source', () => {
    const state = reduce(at('detecting'), { type: 'TRACK_DETECTED', sample: SAMPLE });
    expect(state.track?.title).toBe('Song');
    expect(state.source).toBe('spotify');
    expect(state.trackKey).toBe('artist::song');
  });

  it('marks unsynced lyrics', () => {
    const state = reduce(at('fetching'), { type: 'LYRICS_LOADED', doc: doc(false) });
    expect(state.unsynced).toBe(true);
  });

  it('clears a previous error when lyrics finally arrive', () => {
    const errored = at('fetching', {
      lastError: { error: { code: 'internal_error', message: 'boom', retryable: false } },
    });
    expect(reduce(errored, { type: 'LYRICS_LOADED', doc: doc() }).lastError).toBeNull();
  });

  it('keeps lyrics when a repeated sample reports the same track', () => {
    const synced = at('synced', { lyrics: doc(), trackKey: 'artist::song' });
    const state = reduce(synced, { type: 'TRACK_DETECTED', sample: SAMPLE });
    expect(state.lyrics).not.toBeNull();
    expect(state.status).toBe('fetching');
  });

  it('toggles the offline flag', () => {
    expect(reduce(at('synced'), { type: 'OFFLINE', offline: true }).offline).toBe(true);
  });

  it('fully resets on RESET', () => {
    const dirty = at('synced', { lyrics: doc(), offline: true, trackKey: 'x' });
    expect(reduce(dirty, { type: 'RESET' })).toEqual(createInitialState());
  });
});

describe('describeState', () => {
  it('summarises for logs', () => {
    const state = at('synced', {
      track: SAMPLE.track,
      lyrics: doc(),
      offline: true,
    });
    const text = describeState(state);
    expect(text).toContain('status=synced');
    expect(text).toContain('Artist - Song');
    expect(text).toContain('offline');
  });

  it('omits absent fields', () => {
    expect(describeState(createInitialState())).toBe('status=idle');
  });
});
