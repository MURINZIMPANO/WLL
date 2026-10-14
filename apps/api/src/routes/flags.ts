import { DEFAULT_FEATURE_FLAGS, FEATURE_FLAG_NAMES, type FeatureFlag } from '@lyriclens/shared';
import type { FastifyInstance } from 'fastify';

/**
 * Runtime feature flags.
 *
 * The web app reads these at boot to decide which routes and nav entries to
 * render. Exposing them over HTTP (rather than baking them into the bundle) is
 * what lets a phase be enabled in staging without a rebuild.
 */
export function registerFlagRoutes(
  app: FastifyInstance,
  flags: Record<FeatureFlag, boolean>,
): void {
  app.get('/v1/flags', async () => ({
    flags,
    names: FEATURE_FLAG_NAMES,
    defaults: DEFAULT_FEATURE_FLAGS,
  }));

  app.get('/v1/flags/:flag', async (request, reply) => {
    const { flag } = request.params as { flag: string };

    if (!(FEATURE_FLAG_NAMES as string[]).includes(flag)) {
      reply.status(404).send({
        error: {
          code: 'not_found',
          message: `Unknown feature flag '${flag}'`,
          details: { known: FEATURE_FLAG_NAMES },
          retryable: false,
          requestId: request.requestId,
        },
      });
      return;
    }

    return { flag, enabled: flags[flag as FeatureFlag] === true };
  });
}
