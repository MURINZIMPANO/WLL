import { createErrorEnvelope, isAppError, type AppError } from '@lyriclens/shared';
import fp from 'fastify-plugin';
import { randomUUID } from 'node:crypto';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

/**
 * Attach a correlation id to every request and echo it on the reply, so a user
 * can quote it in a bug report and we can find that exact request in the logs.
 *
 * An inbound `x-request-id` is trusted only if it is a UUID; anything else is
 * replaced, which prevents log injection through the header.
 */

declare module 'fastify' {
  interface FastifyRequest {
    requestId: string;
  }
}

export const REQUEST_ID_HEADER = 'x-request-id';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const requestContext = fp(async (app: FastifyInstance) => {
  app.decorateRequest('requestId', '');

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const inbound = request.headers[REQUEST_ID_HEADER];
    const candidate = Array.isArray(inbound) ? inbound[0] : inbound;

    request.requestId = candidate !== undefined && UUID.test(candidate) ? candidate : randomUUID();
    void reply.header(REQUEST_ID_HEADER, request.requestId);
  });
});

/**
 * Normalise every thrown value into the shared error envelope.
 *
 * This is the only place in the API allowed to shape an error response, which
 * is what lets clients parse exactly one shape.
 */
export const errorHandler = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: unknown, request: FastifyRequest, reply: FastifyReply) => {
    const requestId = request.requestId;

    // 1. Our own errors carry a deliberate code, status and retryability.
    if (isAppError(error)) {
      if (error.statusCode >= 500) {
        request.log.error({ err: error, requestId }, 'Request failed');
      } else {
        request.log.warn(
          { requestId, code: error.code, message: error.message },
          'Request rejected',
        );
      }
      reply.status(error.statusCode).send(error.toEnvelope(requestId));
      return;
    }

    // 2. Fastify's own client-side errors (malformed JSON, bad content-type,
    //    payload too large) have a statusCode but no AppError code. The message
    //    describes the caller's own request, so it is safe to echo back.
    const status = (error as { statusCode?: unknown }).statusCode;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      request.log.warn({ requestId, statusCode: status }, 'Malformed request');
      reply
        .status(status)
        .send(
          createErrorEnvelope(
            'bad_request',
            error instanceof Error ? error.message : 'Malformed request',
            undefined,
            false,
            requestId,
          ),
        );
      return;
    }

    // 3. Everything else is ours to fix. Log the detail, tell the client nothing.
    request.log.error({ err: error, requestId }, 'Unhandled request error');
    reply
      .status(500)
      .send(
        createErrorEnvelope(
          'internal_error',
          'An unexpected error occurred',
          undefined,
          false,
          requestId,
        ),
      );
  });

  app.setNotFoundHandler((request: FastifyRequest, reply: FastifyReply) => {
    reply
      .status(404)
      .send(
        createErrorEnvelope(
          'not_found',
          `No route for ${request.method} ${request.url}`,
          undefined,
          false,
          request.requestId,
        ),
      );
  });
});

export type { AppError };
