import { z } from 'zod';

/**
 * Background job contracts.
 *
 * LyricLens runs a table-backed queue (SQLite in dev, Postgres in production)
 * rather than Redis + BullMQ, because the dev machine has no container runtime
 * and the job shapes here are small. Swapping in a hosted Redis later means
 * reimplementing `JobQueue`, not touching callers.
 */

export const JOB_KINDS = ['transcribe', 'render', 'translate', 'pronounce'] as const;
export type JobKind = (typeof JOB_KINDS)[number];

export const JOB_STATES = ['queued', 'running', 'succeeded', 'failed', 'cancelled'] as const;
export type JobState = (typeof JOB_STATES)[number];

export const JobPayloadSchema = z.discriminatedUnion('kind', [
  z.object({
    kind: z.literal('transcribe'),
    sessionId: z.string().min(1),
    mediaKey: z.string().min(1),
    language: z.string().nullable().default(null),
    modelSize: z.enum(['tiny', 'base', 'small', 'medium']).default('tiny'),
    wordLevelTimestamps: z.boolean().default(true),
  }),
  z.object({
    kind: z.literal('render'),
    sessionId: z.string().min(1),
    output: z.enum(['mp4', 'webm']).default('mp4'),
    width: z.number().int().min(16).max(3840).default(1080),
    height: z.number().int().min(16).max(2160).default(1920),
    fps: z.number().int().min(1).max(60).default(30),
    audioKey: z.string().nullable().default(null),
  }),
  z.object({
    kind: z.literal('translate'),
    sessionId: z.string().min(1),
    targetLanguage: z.string().min(2),
  }),
  z.object({
    kind: z.literal('pronounce'),
    sessionId: z.string().min(1),
    text: z.string().min(1),
    language: z.string().min(2),
  }),
]);
export type JobPayload = z.infer<typeof JobPayloadSchema>;

export const JobRecordSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(JOB_KINDS),
  state: z.enum(JOB_STATES),
  payload: JobPayloadSchema,
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  progress: z.number().min(0).max(1),
  result: z.unknown().nullable(),
  error: z.string().nullable(),
  createdAtMs: z.number().int().nonnegative(),
  /** Earliest time this job may be claimed; moves forward with retry backoff. */
  runAfterMs: z.number().int().nonnegative(),
  startedAtMs: z.number().int().nonnegative().nullable(),
  finishedAtMs: z.number().int().nonnegative().nullable(),
});
export type JobRecord = z.infer<typeof JobRecordSchema>;

export interface EnqueueInput {
  kind: JobKind;
  payload: JobPayload;
  maxAttempts?: number;
  /** Deduplicate on this key while an equivalent job is still queued/running. */
  idempotencyKey?: string;
}

export interface JobProgressEvent {
  id: string;
  state: JobState;
  progress: number;
  result?: unknown;
  error?: string | null;
}

export interface JobQueue {
  enqueue(input: EnqueueInput): Promise<JobRecord>;
  get(id: string): Promise<JobRecord | null>;
  /** Marks a job for execution; the worker then drives state transitions. */
  claimNext(workerId: string): Promise<JobRecord | null>;
  heartbeat(id: string, workerId: string): Promise<void>;
  complete(id: string, result: unknown): Promise<JobRecord>;
  fail(id: string, error: string): Promise<JobRecord>;
  progress(id: string, fraction: number): Promise<void>;
  listByKind(kind: JobKind, limit?: number): Promise<JobRecord[]>;
  /** Requeues jobs whose worker died mid-flight. Safe to call at boot. */
  requeueStale(olderThanMs: number): Promise<number>;
  subscribe(id: string, listener: (event: JobProgressEvent) => void): () => void;
  close(): Promise<void>;
}

/** Exponential backoff with jitter, capped at 5 minutes. */
export function backoffDelayMs(attempt: number, baseMs = 2000, maxMs = 300_000): number {
  const exponential = Math.min(maxMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = exponential * 0.25 * Math.random();
  return Math.round(Math.min(maxMs, exponential + jitter));
}
