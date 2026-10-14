import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { JobProgressEvent } from '@lyriclens/shared';

import type { SqliteJobQueue } from '../src/queue/sqlite-queue.js';
import { createQueue, type QueueHarness } from './harness.js';

const TRANSCRIBE_PAYLOAD = {
  kind: 'transcribe' as const,
  sessionId: 'session-1',
  mediaKey: 'uploads/ab/abc123.mp4',
  language: null,
  modelSize: 'tiny' as const,
  wordLevelTimestamps: true,
};

describe('SqliteJobQueue', () => {
  let harness: QueueHarness;
  let clock = 1_000_000;
  let queue: SqliteJobQueue;

  beforeEach(async () => {
    harness = await createQueue({ now: () => clock });
    queue = harness.queue;
  });

  afterEach(() => {
    harness.close();
  });

  describe('enqueue', () => {
    it('creates a queued job with defaults', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });

      expect(job.state).toBe('queued');
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
      expect(job.progress).toBe(0);
      expect(job.payload.kind).toBe('transcribe');
      expect(job.payload).toMatchObject({
        sessionId: 'session-1',
        mediaKey: 'uploads/ab/abc123.mp4',
      });
    });

    it('honours maxAttempts', async () => {
      const job = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        maxAttempts: 5,
      });
      expect(job.maxAttempts).toBe(5);
    });

    it('rejects a payload that does not match the discriminated union', async () => {
      await expect(
        queue.enqueue({ kind: 'transcribe', payload: { kind: 'nope' } as never }),
      ).rejects.toThrow();
    });

    it('returns the existing job for a repeated idempotency key', async () => {
      const first = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        idempotencyKey: 'dedupe-1',
      });
      const second = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        idempotencyKey: 'dedupe-1',
      });

      expect(second.id).toBe(first.id);
    });

    it('creates distinct jobs for distinct idempotency keys', async () => {
      const first = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        idempotencyKey: 'k1',
      });
      const second = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        idempotencyKey: 'k2',
      });
      expect(second.id).not.toBe(first.id);
    });
  });

  describe('claiming', () => {
    it('returns null when nothing is queued', async () => {
      expect(await queue.claimNext('worker-a')).toBeNull();
    });

    it('claims a queued job and marks it running', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      const claimed = await queue.claimNext('worker-1');

      expect(claimed?.id).toBe(job.id);
      expect(claimed?.state).toBe('running');
      expect(claimed?.attempts).toBe(1);
      expect(claimed?.startedAtMs).toBe(clock);
    });

    it('never hands the same job to two workers', async () => {
      await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });

      const [first, second] = await Promise.all([
        queue.claimNext('worker-a'),
        queue.claimNext('worker-b'),
      ]);

      const claimed = [first, second].filter((job) => job !== null);
      expect(claimed).toHaveLength(1);
    });

    it('claims in creation order', async () => {
      const first = await queue.enqueue({
        kind: 'transcribe',
        payload: { ...TRANSCRIBE_PAYLOAD, sessionId: 'first' },
      });
      const second = await queue.enqueue({
        kind: 'transcribe',
        payload: { ...TRANSCRIBE_PAYLOAD, sessionId: 'second' },
      });

      expect((await queue.claimNext('w'))?.id).toBe(first.id);
      expect((await queue.claimNext('w'))?.id).toBe(second.id);
    });
  });

  describe('lifecycle', () => {
    it('completes a job with its result', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      await queue.claimNext('worker-1');

      const done = await queue.complete(job.id, { lines: 42 });
      expect(done.state).toBe('succeeded');
      expect(done.progress).toBe(1);
      expect(done.result).toEqual({ lines: 42 });
      expect(done.finishedAtMs).toBe(clock);
    });

    it('records progress and clamps it to 0..1', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });

      await queue.progress(job.id, 0.5);
      expect((await queue.get(job.id))?.progress).toBe(0.5);

      await queue.progress(job.id, 5);
      expect((await queue.get(job.id))?.progress).toBe(1);

      await queue.progress(job.id, -2);
      expect((await queue.get(job.id))?.progress).toBe(0);
    });

    it('records a heartbeat', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      await queue.claimNext('worker-1');

      clock += 5_000;
      await queue.heartbeat(job.id, 'worker-1');
      expect((await queue.get(job.id))?.state).toBe('running');
    });
  });

  describe('failure and backoff', () => {
    it('requeues a failing job with a delayed retry', async () => {
      const job = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        maxAttempts: 3,
      });
      await queue.claimNext('worker-1');

      const failed = await queue.fail(job.id, 'provider unreachable');
      expect(failed.state).toBe('queued');
      expect(failed.error).toBe('provider unreachable');
      expect(failed.runAfterMs).toBeGreaterThan(clock);
    });

    it('does not hand out a job that is still in its backoff window', async () => {
      const job = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        maxAttempts: 3,
      });
      await queue.claimNext('worker-1');
      await queue.fail(job.id, 'transient');

      expect(await queue.claimNext('worker-2')).toBeNull();

      // Once the backoff window has passed it becomes claimable again.
      clock += 400_000;
      const retried = await queue.claimNext('worker-2');
      expect(retried?.id).toBe(job.id);
      expect(retried?.attempts).toBe(2);
    });

    it('marks a job failed once attempts are exhausted', async () => {
      const job = await queue.enqueue({
        kind: 'transcribe',
        payload: TRANSCRIBE_PAYLOAD,
        maxAttempts: 1,
      });
      await queue.claimNext('worker-1');

      const failed = await queue.fail(job.id, 'permanent failure');
      expect(failed.state).toBe('failed');
      expect(failed.finishedAtMs).toBe(clock);
    });

    it('refuses to fail an unknown job', async () => {
      await expect(queue.fail('does-not-exist', 'x')).rejects.toThrow(/unknown job/);
    });

    it('refuses to complete an unknown job', async () => {
      await expect(queue.complete('does-not-exist', {})).rejects.toThrow(/unknown job/);
    });
  });

  describe('stale job recovery', () => {
    it('requeues a running job whose worker stopped heartbeating', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      await queue.claimNext('dead-worker');

      clock += 60_000;
      const recovered = await queue.requeueStale(30_000);
      expect(recovered).toBeGreaterThanOrEqual(1);

      const record = await queue.get(job.id);
      expect(record?.state).toBe('queued');
    });

    it('leaves a job alone when its worker is still heartbeating', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      await queue.claimNext('live-worker');
      await queue.heartbeat(job.id, 'live-worker');

      clock += 10_000;
      await queue.requeueStale(30_000);
      expect((await queue.get(job.id))?.state).toBe('running');
    });
  });

  describe('listing and counting', () => {
    it('lists jobs by kind', async () => {
      await queue.enqueue({
        kind: 'render',
        payload: {
          kind: 'render',
          sessionId: 's',
          output: 'mp4',
          width: 1080,
          height: 1920,
          fps: 30,
          audioKey: null,
        },
      });
      await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });

      const renders = await queue.listByKind('render');
      expect(renders).toHaveLength(1);
      expect(renders[0]?.kind).toBe('render');
    });

    it('counts jobs by state', async () => {
      const before = await queue.countByState('queued');
      await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });

      expect(await queue.countByState('queued')).toBe(before + 1);
      expect(await queue.countByState('succeeded')).toBe(0);
    });
  });

  describe('progress events', () => {
    it('notifies a subscriber as the job advances', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      const events: JobProgressEvent[] = [];
      const unsubscribe = queue.subscribe(job.id, (event) => {
        events.push(event);
      });

      await queue.claimNext('worker-1');
      await queue.progress(job.id, 0.75);
      await queue.complete(job.id, { ok: true });

      unsubscribe();
      expect(events.map((event) => event.state)).toContain('running');
      expect(events.map((event) => event.state)).toContain('succeeded');
      expect(events.some((event) => event.progress === 0.75)).toBe(true);
    });

    it('stops notifying after unsubscribe', async () => {
      const job = await queue.enqueue({ kind: 'transcribe', payload: TRANSCRIBE_PAYLOAD });
      const events: JobProgressEvent[] = [];
      const unsubscribe = queue.subscribe(job.id, (event) => {
        events.push(event);
      });

      await queue.complete(job.id, {});
      const countAfterFirst = events.length;

      unsubscribe();
      await queue.progress(job.id, 0.5);
      expect(events).toHaveLength(countAfterFirst);
    });
  });
});
