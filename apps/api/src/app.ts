import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import { parseCorsOrigins, resolveFeatureFlags, type FeatureFlag } from '@lyriclens/shared';
import Fastify, { type FastifyInstance } from 'fastify';

import type { AppConfig } from './config/config.js';
import { openDatabase, type DatabaseHandle } from './db/client.js';
import { resolveDatabaseUrl } from './db/url.js';
import { createLoggerConfig, newRequestId } from './lib/logger.js';
import { errorHandler, requestContext } from './plugins/observability.js';
import { SqliteJobQueue } from './queue/sqlite-queue.js';
import { registerFlagRoutes } from './routes/flags.js';
import { registerHealthRoutes } from './routes/health.js';
import { registerProviderRoutes } from './routes/providers.js';
import { createStorage } from './storage/index.js';
import type { StorageDriver } from '@lyriclens/shared';

export const API_VERSION = '0.1.0';

export interface BuildAppOptions {
  config: AppConfig;
  /** Overrides for tests; production wires these from the config. */
  database?: DatabaseHandle;
  storage?: StorageDriver;
}

export interface App {
  server: FastifyInstance;
  db: DatabaseHandle;
  storage: StorageDriver;
  queue: SqliteJobQueue;
  flags: Record<FeatureFlag, boolean>;
  close(): Promise<void>;
}

/**
 * Compose the API.
 *
 * Every dependency is injectable so integration tests can run against a real
 * SQLite file and a real temp directory without touching the developer's
 * working copy.
 */
export async function buildApp(options: BuildAppOptions): Promise<App> {
  const { config } = options;
  const { env } = config;
  const startedAtMs = Date.now();

  const flags = resolveFeatureFlags(process.env).values;

  const logger = createLoggerConfig({
    level: env.LOG_LEVEL,
    pretty: env.LOG_PRETTY,
    isProduction: config.isProduction,
  });

  const server = Fastify({
    logger,
    // Trust no proxy header by default; set this when running behind one.
    trustProxy: false,
    bodyLimit: env.MAX_UPLOAD_MB * 1024 * 1024,
    genReqId: () => newRequestId(),
  });

  const db =
    options.database ?? openDatabase(resolveDatabaseUrl(env.DATABASE_URL), env.DATABASE_AUTH_TOKEN);

  const storage = options.storage ?? createStorage(env);

  const queue = new SqliteJobQueue({ db: db.db });

  await server.register(requestContext);
  await server.register(errorHandler);

  await server.register(cors, {
    origin:
      parseCorsOrigins(env.CORS_ORIGINS).length > 0 ? parseCorsOrigins(env.CORS_ORIGINS) : false,
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await server.register(rateLimit, {
    max: config.isProduction ? 120 : 1_000,
    timeWindow: '1 minute',
    // Health checks and flag reads must never be throttled — a load balancer
    // polling a rate-limited /v1/health would see a false outage.
    allowList: (request) => request.url === '/v1/health' || request.url === '/v1/flags',
  });

  registerHealthRoutes(server, {
    db: { execute: (sql) => db.client.execute(sql) },
    storage,
    queue,
    version: API_VERSION,
    startedAtMs,
  });

  registerFlagRoutes(server, flags);
  registerProviderRoutes(server, env);

  return {
    server,
    db,
    storage,
    queue,
    flags,
    async close() {
      await queue.close();
      await server.close();
      // Always close the handle this app used, including an injected one: the
      // app owns its lifecycle. Leaving it open leaves the SQLite WAL and SHM
      // files locked, which breaks any test that cleans up its temp directory.
      db.close();
    },
  };
}
