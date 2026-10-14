import Fastify from 'fastify';

import { missingEncoders, probeFfmpeg } from './ffmpeg.js';

/**
 * Render service — Phase 0 surface.
 *
 * It exists now so the ffmpeg dependency is detected and reported from day one,
 * rather than surfacing as a surprise in Phase 5. Actual lyric-video rendering
 * arrives with the export phase; PNG lyric cards are produced client-side with
 * Canvas and need no server.
 */
const server = Fastify({
  logger: { level: process.env['LOG_LEVEL'] ?? 'info' },
});

server.get('/health', async () => {
  const ffmpeg = await probeFfmpeg();
  const missing = missingEncoders(ffmpeg);

  return {
    status: ffmpeg.available && missing.length === 0 ? 'ok' : 'degraded',
    service: 'lyriclens-render',
    version: '0.1.0',
    ffmpeg: {
      available: ffmpeg.available,
      version: ffmpeg.version,
      missingEncoders: missing,
      error: ffmpeg.error,
    },
  };
});

const port = Number.parseInt(process.env['RENDER_PORT'] ?? '4002', 10);

await server.listen({ port, host: '127.0.0.1' });
server.log.info({ port }, 'LyricLens render service listening');
