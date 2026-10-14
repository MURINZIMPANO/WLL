import { randomUUID } from 'node:crypto';

/**
 * Logger configuration.
 *
 * Fastify owns the pino instance rather than us constructing one and injecting
 * it: passing a `Logger` instance changes Fastify's type parameter away from
 * `FastifyBaseLogger`, which then breaks every plugin signature that takes a
 * plain `FastifyInstance`. Configuring it instead keeps the types honest.
 *
 * The return type is declared locally rather than as
 * `FastifyServerOptions['logger']`, which is a union across HTTP/1 and HTTP/2
 * and made TypeScript resolve the server overload to HTTP/2.
 *
 * JSON in production (what a log shipper wants), pretty in development (what a
 * human wants).
 */

export interface LoggerConfig {
  level: string;
  redact: { paths: string[]; censor: string };
  transport?: { target: string; options: Record<string, unknown> };
}

export interface LoggerConfigOptions {
  level: string;
  pretty: boolean;
  isProduction: boolean;
}

/**
 * Fields that must never reach a log, whatever a caller does. Both the request
 * headers and the obvious credential field names are covered.
 */
const REDACT_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'password',
  'token',
  '*.token',
  'accessToken',
  'refreshToken',
  'apiKey',
  '*.apiKey',
  'secret',
  '*.secret',
];

export function createLoggerConfig(options: LoggerConfigOptions): LoggerConfig {
  const usePretty = options.pretty && !options.isProduction;

  return {
    level: options.level,
    redact: { paths: REDACT_PATHS, censor: '[redacted]' },
    ...(usePretty
      ? {
          transport: {
            target: 'pino-pretty',
            options: { colorize: true, translateTime: 'HH:MM:ss', ignore: 'pid,hostname' },
          },
        }
      : {}),
  };
}

export function newRequestId(): string {
  return randomUUID();
}
