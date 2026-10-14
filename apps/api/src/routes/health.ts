import type { StorageDriver } from '@lyriclens/shared';
import type { FastifyInstance } from 'fastify';

import type { SqliteJobQueue } from '../queue/sqlite-queue.js';
import { LocalStorageDriver } from '../storage/local-driver.js';

export interface HealthDeps {
  db: { execute: (sql: string) => Promise<unknown> };
  storage: StorageDriver;
  queue: SqliteJobQueue;
  version: string;
  startedAtMs: number;
}

export interface HealthReport {
  status: 'ok' | 'degraded';
  version: string;
  uptimeMs: number;
  checks: {
    database: { ok: boolean; detail?: string };
    storage: { ok: boolean; detail?: string; encryption: boolean };
    queue: { ok: boolean; detail?: string; queued: number; running: number; failed: number };
  };
}

/**
 * Liveness + readiness.
 *
 * `/v1/health` is a *deep* check — it touches the database, the storage root
 * and the queue, and returns 503 if any of them is broken, so a load balancer
 * stops sending traffic to a half-dead instance. A liveness-only probe (for the
 * container/orchestrator) would be a separate, cheaper endpoint.
 */
export function registerHealthRoutes(app: FastifyInstance, deps: HealthDeps): void {
  app.get('/v1/health', async (_request, reply) => {
    const report = await checkHealth(deps);

    if (report.status === 'degraded') reply.status(503);
    return report;
  });
}

export async function checkHealth(deps: HealthDeps): Promise<HealthReport> {
  const checks: HealthReport['checks'] = {
    database: { ok: false },
    storage: { ok: false, encryption: false },
    queue: { ok: false, queued: 0, running: 0, failed: 0 },
  };

  try {
    await deps.db.execute('SELECT 1');
    checks.database = { ok: true };
  } catch (error) {
    checks.database = { ok: false, detail: describe(error) };
  }

  try {
    const encrypted = deps.storage instanceof LocalStorageDriver && deps.storage.encryptionEnabled;
    // `exists` on a sentinel key proves the root directory is readable.
    await deps.storage.exists('.healthcheck');
    checks.storage = { ok: true, encryption: encrypted };
  } catch (error) {
    checks.storage = { ok: false, detail: describe(error), encryption: false };
  }

  try {
    const [queued, running, failed] = await Promise.all([
      deps.queue.countByState('queued'),
      deps.queue.countByState('running'),
      deps.queue.countByState('failed'),
    ]);
    checks.queue = { ok: true, queued, running, failed };
  } catch (error) {
    checks.queue = { ok: false, queued: 0, running: 0, failed: 0, detail: describe(error) };
  }

  const healthy = checks.database.ok && checks.storage.ok && checks.queue.ok;

  return {
    status: healthy ? 'ok' : 'degraded',
    version: deps.version,
    uptimeMs: Date.now() - deps.startedAtMs,
    checks,
  };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
