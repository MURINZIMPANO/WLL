import { API_VERSION, buildApp } from './app.js';
import { loadConfig } from './config/config.js';
import { runMigrations } from './db/migrate.js';

/**
 * Process entry point.
 *
 * Migrations run before the server accepts traffic, so a fresh clone is
 * immediately usable with a single `pnpm dev`. A migration failure is fatal:
 * serving requests against a half-migrated database is worse than not starting.
 */
async function main(): Promise<void> {
  const config = loadConfig();
  const { env, notes } = config;

  for (const note of notes) {
    console.warn(`[config] ${note}`);
  }

  await runMigrations(env.DATABASE_URL, env.DATABASE_AUTH_TOKEN);

  const app = await buildApp({ config });

  const shutdown = async (signal: string): Promise<void> => {
    app.server.log.info({ signal }, 'Shutting down');
    try {
      await app.close();
      process.exit(0);
    } catch (error) {
      app.server.log.error({ err: error }, 'Unclean shutdown');
      process.exit(1);
    }
  };

  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.once(signal, () => {
      void shutdown(signal);
    });
  }

  await app.server.listen({ port: env.API_PORT, host: '0.0.0.0' });
  app.server.log.info(
    {
      port: env.API_PORT,
      env: env.NODE_ENV,
      database: env.DATABASE_URL.startsWith('file:') ? 'local sqlite' : 'remote',
    },
    `LyricLens API v${API_VERSION} listening`,
  );
}

main().catch((error: unknown) => {
  console.error('Failed to start LyricLens API:', error instanceof Error ? error.stack : error);
  process.exit(1);
});
