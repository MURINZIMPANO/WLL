import {
  JobPayloadSchema,
  JobRecordSchema,
  QueueError,
  backoffDelayMs,
  type EnqueueInput,
  type JobKind,
  type JobProgressEvent,
  type JobQueue,
  type JobRecord,
  type JobState,
} from '@lyriclens/shared';
import { randomUUID } from 'node:crypto';
import { and, asc, eq, isNull, lt, lte, or, sql } from 'drizzle-orm';

import type { Database } from '../db/client.js';
import { jobs } from '../db/schema.js';

/**
 * SQLite-backed job queue.
 *
 * Replaces Redis + BullMQ for local development, because this machine has no
 * container runtime and the job shapes are small. The `JobQueue` interface in
 * `@lyriclens/shared` is the seam: a hosted-Redis implementation drops in
 * without touching a single caller.
 *
 * Claiming is safe with more than one worker because it is a single
 * `UPDATE ... WHERE id = (SELECT ...)` in a transaction, which SQLite serialises.
 */

export interface SqliteJobQueueOptions {
  db: Database;
  /** Injectable clock keeps backoff and staleness testable. */
  now?: () => number;
}

export class SqliteJobQueue implements JobQueue {
  readonly #db: Database;
  readonly #now: () => number;
  readonly #listeners = new Map<string, Set<(event: JobProgressEvent) => void>>();

  constructor(options: SqliteJobQueueOptions) {
    this.#db = options.db;
    this.#now = options.now ?? Date.now;
  }

  async enqueue(input: EnqueueInput): Promise<JobRecord> {
    const payload = JobPayloadSchema.parse(input.payload);
    const id = randomUUID();
    const now = this.#now();

    if (input.idempotencyKey !== undefined) {
      // Return the existing job rather than creating a duplicate: callers rely
      // on "enqueue twice, run once".
      const existing = await this.#findByIdempotencyKey(input.idempotencyKey);
      if (existing !== null) return existing;
    }

    await this.#db.insert(jobs).values({
      id,
      kind: input.kind,
      state: 'queued',
      payloadJson: JSON.stringify(payload),
      maxAttempts: input.maxAttempts ?? 3,
      idempotencyKey: input.idempotencyKey ?? null,
      runAfterMs: now,
      createdAtMs: now,
      startedAtMs: null,
      finishedAtMs: null,
    });

    const created = await this.get(id);
    if (created === null) throw new QueueError(`Job ${id} vanished immediately after insert`);
    return created;
  }

  async #findByIdempotencyKey(key: string): Promise<JobRecord | null> {
    const rows = await this.#db.select().from(jobs).where(eq(jobs.idempotencyKey, key)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async get(id: string): Promise<JobRecord | null> {
    const rows = await this.#db.select().from(jobs).where(eq(jobs.id, id)).limit(1);
    const row = rows[0];
    return row === undefined ? null : toRecord(row);
  }

  async claimNext(workerId: string): Promise<JobRecord | null> {
    const now = this.#now();

    const candidate = await this.#db
      .select()
      .from(jobs)
      .where(and(eq(jobs.state, 'queued'), lte(jobs.runAfterMs, now)))
      .orderBy(asc(jobs.createdAtMs))
      .limit(1);

    const row = candidate[0];
    if (row === undefined) return null;

    // Guarded update: only the worker that wins the state transition owns the job.
    const result = await this.#db
      .update(jobs)
      .set({
        state: 'running',
        workerId,
        startedAtMs: now,
        heartbeatAtMs: now,
        attempts: row.attempts + 1,
      })
      .where(and(eq(jobs.id, row.id), eq(jobs.state, 'queued')))
      .run();

    if (result.rowsAffected === 0) return null;

    const claimed = await this.get(row.id);
    if (claimed !== null) this.#emit(claimed);
    return claimed;
  }

  async heartbeat(id: string, workerId: string): Promise<void> {
    await this.#db
      .update(jobs)
      .set({ heartbeatAtMs: this.#now() })
      .where(and(eq(jobs.id, id), eq(jobs.workerId, workerId)))
      .run();
  }

  async complete(id: string, result: unknown): Promise<JobRecord> {
    const now = this.#now();
    await this.#db
      .update(jobs)
      .set({
        state: 'succeeded',
        resultJson: JSON.stringify(result ?? null),
        finishedAtMs: now,
        progress: 1,
      })
      .where(eq(jobs.id, id))
      .run();

    const record = await this.get(id);
    if (record === null) throw new QueueError(`Cannot complete unknown job ${id}`);
    this.#emit(record);
    return record;
  }

  async fail(id: string, error: string): Promise<JobRecord> {
    const now = this.#now();
    const existing = await this.get(id);
    if (existing === null) throw new QueueError(`Cannot fail unknown job ${id}`);

    const exhausted = existing.attempts >= existing.maxAttempts;
    const state: JobState = exhausted ? 'failed' : 'queued';

    await this.#db
      .update(jobs)
      .set({
        state,
        error,
        // Requeue with exponential backoff so a failing provider is not hammered.
        runAfterMs: exhausted ? existing.runAfterMs : now + backoffDelayMs(existing.attempts),
        ...(exhausted ? { finishedAtMs: now } : {}),
      })
      .where(eq(jobs.id, id))
      .run();

    const record = await this.get(id);
    if (record === null) throw new QueueError(`Job ${id} vanished while failing`);
    this.#emit(record);
    return record;
  }

  async progress(id: string, fraction: number): Promise<void> {
    const clamped = Math.min(1, Math.max(0, fraction));
    await this.#db.update(jobs).set({ progress: clamped }).where(eq(jobs.id, id)).run();
    const record = await this.get(id);
    if (record !== null) this.#emit(record);
  }

  async listByKind(kind: JobKind, limit = 50): Promise<JobRecord[]> {
    const rows = await this.#db
      .select()
      .from(jobs)
      .where(eq(jobs.kind, kind))
      .orderBy(asc(jobs.createdAtMs))
      .limit(limit);
    return rows.map(toRecord);
  }

  /**
   * Return `running` jobs whose worker stopped heartbeating to `queued`.
   * Called at boot, and periodically by a supervisor.
   */
  async requeueStale(olderThanMs: number): Promise<number> {
    const cutoff = this.#now() - olderThanMs;
    const result = await this.#db
      .update(jobs)
      .set({ state: 'queued', workerId: null, runAfterMs: this.#now() })
      .where(
        and(
          eq(jobs.state, 'running'),
          or(isNull(jobs.heartbeatAtMs), lt(jobs.heartbeatAtMs, cutoff)),
        ),
      )
      .run();

    return result.rowsAffected ?? 0;
  }

  async countByState(state: JobState): Promise<number> {
    const result = await this.#db
      .select({ value: sql<number>`count(*)` })
      .from(jobs)
      .where(eq(jobs.state, state));
    return result[0]?.value ?? 0;
  }

  subscribe(id: string, listener: (event: JobProgressEvent) => void): () => void {
    const existing = this.#listeners.get(id);
    if (existing === undefined) {
      this.#listeners.set(id, new Set([listener]));
    } else {
      existing.add(listener);
    }
    return () => {
      this.#listeners.get(id)?.delete(listener);
    };
  }

  #emit(record: JobRecord): void {
    const listeners = this.#listeners.get(record.id);
    if (listeners === undefined) return;
    const event: JobProgressEvent = {
      id: record.id,
      state: record.state,
      progress: record.progress,
      result: record.result,
      error: record.error,
    };
    for (const listener of listeners) listener(event);
  }

  close(): Promise<void> {
    this.#listeners.clear();
    return Promise.resolve();
  }
}

/** Row -> contract, re-validating so a bad payload can never reach a worker. */
function toRecord(row: typeof jobs.$inferSelect): JobRecord {
  return JobRecordSchema.parse({
    id: row.id,
    kind: row.kind,
    state: row.state,
    payload: JSON.parse(row.payloadJson),
    attempts: row.attempts,
    maxAttempts: row.maxAttempts,
    progress: row.progress,
    result: row.resultJson === null ? null : JSON.parse(row.resultJson),
    error: row.error,
    createdAtMs: row.createdAtMs,
    runAfterMs: row.runAfterMs,
    startedAtMs: row.startedAtMs,
    finishedAtMs: row.finishedAtMs,
  });
}
