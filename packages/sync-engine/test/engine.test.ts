import { normalizeLyricsDoc, type LyricsDoc, type TrackIdentity } from '@lyriclens/shared';
import { describe, expect, it } from 'vitest';

import { ManualClock } from '../src/clock.js';
import { SyncEngine } from '../src/engine.js';
import type { EngineSource, PositionSample } from '../src/types.js';

const TRACK: TrackIdentity = {
  title: 'Test Track',
  artist: 'Test Artist',
  album: null,
  durationMs: 200_000,
  isrc: null,
  spotifyId: null,
  musicbrainzId: null,
  coverUrl: null,
};

/** A source the test drives directly — no timers, no randomness. */
class FakeSource implements EngineSource {
  readonly id = 'fake';
  #sample: PositionSample | null = null;
  #listeners = new Set<() => void>();

  sample(): PositionSample | null {
    return this.#sample;
  }

  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  set(sample: PositionSample | null): void {
    this.#sample = sample;
  }

  emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

function lyrics(lineStarts: number[], provider = 'test'): LyricsDoc {
  return normalizeLyricsDoc({
    provider,
    lines: lineStarts.map((startMs, index) => ({ startMs, text: `line ${index}` })),
  });
}

function build(clock = new ManualClock()) {
  const source = new FakeSource();
  const engine = new SyncEngine({ source, clock, pollIntervalMs: 0 });
  return { source, engine, clock };
}

const baseSample = (overrides: Partial<PositionSample> = {}): PositionSample => ({
  positionMs: 0,
  playing: true,
  durationMs: 200_000,
  track: TRACK,
  source: 'desktop_media_session',
  trackKey: 'test artist::test track',
  ...overrides,
});

describe('SyncEngine — lifecycle', () => {
  it('starts in idle and moves to detecting', () => {
    const { engine } = build();
    expect(engine.read().status).toBe('idle');
    engine.start();
    expect(engine.read().status).toBe('detecting');
  });

  it('is idempotent on repeated start and stops cleanly', () => {
    const { engine } = build();
    engine.start();
    engine.start();
    expect(engine.running).toBe(true);
    engine.stop();
    expect(engine.running).toBe(false);
    engine.stop();
  });

  it('detaches its source subscription on stop', () => {
    const { source, engine } = build();
    engine.start();
    engine.stop();
    source.set(baseSample({ positionMs: 1_000 }));
    source.emit();
    // No sample was consumed after stop, so the anchor was never established.
    expect(engine.read().frame.positionMs).toBe(0);
  });

  it('pulls an initial sample when started', () => {
    const { source, engine } = build();
    source.set(baseSample({ positionMs: 5_000 }));
    engine.start();
    expect(engine.read().frame.positionMs).toBe(5_000);
  });
});

describe('SyncEngine — state machine wiring', () => {
  it('reaches synced once lyrics arrive', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample({ positionMs: 1_000 }));
    engine.poll();
    expect(engine.read().status).toBe('fetching');

    engine.setLyrics(lyrics([0, 2_000]));
    const snapshot = engine.read();
    expect(snapshot.status).toBe('synced');
    expect(snapshot.lyrics?.lines).toHaveLength(2);
  });

  it('stays synced and flags unsynced lyrics when there are no timings', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample());
    engine.poll();
    engine.setLyrics({ ...lyrics([0]), synced: false });

    const snapshot = engine.read();
    expect(snapshot.status).toBe('synced');
    expect(snapshot.unsynced).toBe(true);
    expect(snapshot.frame.activeLineIndex).toBe(-1);
  });

  it('surfaces an error without losing the lyrics already loaded', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample());
    engine.poll();
    engine.setLyrics(lyrics([0]));
    expect(engine.read().status).toBe('synced');

    engine.reportError(new Error('network down'));

    const snapshot = engine.read();
    expect(snapshot.status).toBe('error');
    expect(snapshot.lastError?.error.code).toBe('internal_error');
    expect(snapshot.lastError?.error.message).not.toContain('network down');
    expect(snapshot.lyrics).not.toBeNull();
  });

  it('recovers when lyrics arrive after an error', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample());
    engine.poll();
    engine.reportError(new Error('boom'));
    expect(engine.read().status).toBe('error');

    engine.setLyrics(lyrics([0]));
    expect(engine.read().status).toBe('synced');
  });

  it('ignores lyrics that arrive before any track is detected', () => {
    const { engine } = build();
    engine.start();
    expect(engine.read().status).toBe('detecting');
    engine.setLyrics(lyrics([0]));
    expect(engine.read().lyrics).toBeNull();
  });

  it('records offline state', () => {
    const { engine } = build();
    engine.setOffline(true);
    expect(engine.read().offline).toBe(true);
  });

  it('resets to a clean idle state', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample({ positionMs: 9_000 }));
    engine.poll();
    engine.setLyrics(lyrics([0]));

    engine.reset();
    const snapshot = engine.read();
    expect(snapshot.status).toBe('idle');
    expect(snapshot.lyrics).toBeNull();
    expect(snapshot.track).toBeNull();
    expect(snapshot.frame.positionMs).toBe(0);
    expect(snapshot.correctionCount).toBe(0);
  });
});

describe('SyncEngine — track changes', () => {
  it('drops the previous lyrics when the track changes', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample());
    engine.poll();
    engine.setLyrics(lyrics([0]));
    expect(engine.read().lyrics).not.toBeNull();

    source.set(
      baseSample({
        positionMs: 0,
        trackKey: 'someone else::another song',
        track: { ...TRACK, title: 'Another Song', artist: 'Someone Else' },
      }),
    );
    engine.poll();

    const snapshot = engine.read();
    expect(snapshot.status).toBe('fetching');
    expect(snapshot.lyrics).toBeNull();
    expect(snapshot.track?.title).toBe('Another Song');
  });

  it('keeps lyrics when a sample repeats the same track', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample());
    engine.poll();
    engine.setLyrics(lyrics([0]));

    source.set(baseSample({ positionMs: 3_000 }));
    engine.poll();

    expect(engine.read().status).toBe('synced');
    expect(engine.read().lyrics).not.toBeNull();
  });
});

describe('SyncEngine — position interpolation and the 300ms guarantee', () => {
  it('interpolates between provider samples', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000 }));
    engine.poll();

    clock.advance(400);
    expect(engine.read().frame.positionMs).toBe(10_400);
    clock.advance(600);
    expect(engine.read().frame.positionMs).toBe(11_000);
  });

  it('freezes while paused', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000, playing: false }));
    engine.poll();

    clock.advance(5_000);
    expect(engine.read().frame.positionMs).toBe(10_000);
    expect(engine.read().frame.playing).toBe(false);
  });

  it('never lets visible drift exceed 300ms against a once-per-second source', () => {
    const { source, engine, clock } = build();
    engine.start();

    let worstDrift = 0;
    const DURATION_MS = 120_000;

    // Ground truth: the track is playing continuously from t=0.
    for (let elapsed = 0; elapsed <= DURATION_MS; elapsed += 100) {
      // Provider publishes its true position once per second.
      if (elapsed % 1_000 === 0) {
        source.set(baseSample({ positionMs: elapsed }));
        engine.poll();
      }
      clock.advance(100);

      const { frame } = engine.read();
      worstDrift = Math.max(worstDrift, Math.abs(frame.positionMs - elapsed));
    }

    expect(worstDrift).toBeLessThan(300);
  });

  it('corrects a provider that reports a stale position', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000 }));
    engine.poll();

    clock.advance(1_000);
    // Provider is a full second behind where we predicted.
    source.set(baseSample({ positionMs: 10_100 }));
    engine.poll();

    const snapshot = engine.read();
    expect(Math.abs(snapshot.lastDriftMs)).toBeGreaterThan(100);
    expect(snapshot.correctionCount).toBeGreaterThan(0);
    // The anchor moved to the reported truth, so the frame is correct again.
    expect(snapshot.frame.positionMs).toBe(10_100);
  });

  it('rejects an undeclared glitch but honours a declared seek', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000 }));
    engine.poll();

    clock.advance(1_000);
    source.set(baseSample({ positionMs: 90_000 }));
    engine.poll();
    expect(engine.read().frame.positionMs).toBe(11_000);

    source.set(baseSample({ positionMs: 95_000, seeked: true }));
    engine.poll();
    expect(engine.read().frame.positionMs).toBe(95_000);
  });

  it('drops a structurally impossible sample', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000 }));
    engine.poll();

    clock.advance(1_000);
    source.set(baseSample({ positionMs: 10_000_000 }));
    engine.poll();

    expect(engine.read().frame.positionMs).toBe(11_000);
  });

  it('rejects a negative position', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample({ positionMs: -1 }));
    engine.poll();
    expect(engine.read().frame.positionMs).toBe(0);
  });
});

describe('SyncEngine — lyric lookup', () => {
  it('highlights the line containing the current position', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 0 }));
    engine.poll();
    engine.setLyrics(lyrics([0, 5_000, 10_000]));

    expect(engine.read().frame.activeLineIndex).toBe(0);
    clock.advance(6_000);
    expect(engine.read().frame.activeLineIndex).toBe(1);
    expect(engine.read().frame.activeLineText).toBe('line 1');
  });

  it('applies the offset by shifting the lookup position', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000 }));
    engine.poll();
    engine.setLyrics(lyrics([0, 10_000, 20_000]));

    expect(engine.read().frame.activeLineIndex).toBe(1);

    engine.setOffset(10_000);
    expect(engine.read().frame.activeLineIndex).toBe(2);
    expect(engine.read().offsetMs).toBe(10_000);

    engine.setOffset(-10_000);
    expect(engine.read().frame.activeLineIndex).toBe(0);
  });

  it('inherits the document offset when lyrics are set', () => {
    const { engine } = build();
    engine.setLyrics({ ...lyrics([0, 1_000]), offsetMs: 250 });
    expect(engine.offsetMs).toBe(250);
  });

  it('ignores a non-finite offset', () => {
    const { engine } = build();
    engine.setOffset(Number.NaN);
    expect(engine.offsetMs).toBe(0);
  });

  it('exposes the active word for karaoke highlighting', () => {
    const { source, engine } = build();
    engine.start();
    source.set(baseSample({ positionMs: 0 }));
    engine.poll();
    engine.setLyrics(lyrics([0, 4_000]));

    // "line 0" is two words spread evenly across 0-4000ms, so word 1 owns
    // 2000-4000ms.
    expect(engine.read().frame.activeWordIndex).toBe(0);
    source.set(baseSample({ positionMs: 1_000 }));
    engine.poll();
    expect(engine.read().frame.activeWordIndex).toBe(0);

    source.set(baseSample({ positionMs: 2_500 }));
    engine.poll();
    expect(engine.read().frame.activeWordIndex).toBe(1);
  });
});

describe('SyncEngine — local position override (replay / A-B loop)', () => {
  it('overrides the source until cleared', () => {
    const { source, engine, clock } = build();
    engine.start();
    source.set(baseSample({ positionMs: 10_000 }));
    engine.poll();

    engine.seekTo(60_000);
    expect(engine.read().frame.positionMs).toBe(60_000);

    clock.advance(1_000);
    expect(engine.read().frame.positionMs).toBe(60_000);

    engine.clearPositionOverride();
    expect(engine.read().frame.positionMs).toBe(11_000);
  });

  it('never produces a negative override', () => {
    const { engine } = build();
    engine.seekTo(-500);
    expect(engine.read().frame.positionMs).toBe(0);
  });
});

describe('SyncEngine — subscriptions', () => {
  it('notifies on meaningful state changes only', () => {
    const { source, engine } = build();
    let notifications = 0;
    engine.subscribe(() => {
      notifications += 1;
    });

    engine.start();
    const afterStart = notifications;

    source.set(baseSample());
    engine.poll();
    const afterDetect = notifications;
    expect(afterDetect).toBeGreaterThan(afterStart);

    // A pure position advance changes no state, so nothing is emitted.
    source.set(baseSample({ positionMs: 1_000 }));
    engine.poll();
    expect(notifications).toBe(afterDetect);
  });

  it('notifies when the offset or an override changes', () => {
    const { engine } = build();
    let notifications = 0;
    engine.subscribe(() => {
      notifications += 1;
    });
    engine.setOffset(500);
    engine.seekTo(1_000);
    expect(notifications).toBe(2);
  });

  it('stops notifying after unsubscribe', () => {
    const { engine } = build();
    let notifications = 0;
    const unsubscribe = engine.subscribe(() => {
      notifications += 1;
    });
    engine.setOffset(100);
    unsubscribe();
    engine.setOffset(200);
    expect(notifications).toBe(1);
  });

  it('drops every listener on dispose', () => {
    const { engine } = build();
    let notifications = 0;
    engine.subscribe(() => {
      notifications += 1;
    });
    engine.start();
    engine.dispose();
    engine.setOffset(100);
    expect(notifications).toBe(1);
  });
});
