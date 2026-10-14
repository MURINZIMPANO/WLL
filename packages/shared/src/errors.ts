/**
 * Structured error taxonomy shared by the API, the web client and the desktop
 * shell. Every failure that crosses a process boundary is normalised into an
 * `ErrorEnvelope` so the UI never has to parse a stack trace or an ad-hoc
 * `{ error: "..." }` shape.
 */

export const ERROR_CODES = [
  'bad_request',
  'validation_failed',
  'unauthorized',
  'forbidden',
  'not_found',
  'conflict',
  'rate_limited',
  'payload_too_large',
  'provider_not_configured',
  'provider_unavailable',
  'provider_terms_violation',
  'upstream_failure',
  'storage_failure',
  'queue_failure',
  'transcription_failed',
  'render_failed',
  'unsupported_media',
  'internal_error',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

/** Default HTTP status per code, so handlers never hand-pick one. */
const STATUS_BY_CODE: Record<ErrorCode, number> = {
  bad_request: 400,
  validation_failed: 422,
  unauthorized: 401,
  forbidden: 403,
  not_found: 404,
  conflict: 409,
  rate_limited: 429,
  payload_too_large: 413,
  provider_not_configured: 501,
  provider_unavailable: 503,
  provider_terms_violation: 451,
  upstream_failure: 502,
  storage_failure: 500,
  queue_failure: 500,
  transcription_failed: 500,
  render_failed: 500,
  unsupported_media: 415,
  internal_error: 500,
};

/** Codes worth retrying with the same inputs (as opposed to a human changing them). */
const RETRYABLE_BY_CODE = new Set<ErrorCode>([
  'rate_limited',
  'provider_unavailable',
  'upstream_failure',
  'queue_failure',
]);

export interface ErrorEnvelope {
  error: {
    code: ErrorCode;
    message: string;
    /** Safe, structured, user-presentable extra context (never secrets). */
    details?: Record<string, unknown>;
    /** Present only when the caller is trusted enough (dev / admin). */
    cause?: string;
    retryable: boolean;
    /** Correlation id — quote this in bug reports. */
    requestId?: string;
  };
}

export interface AppErrorOptions {
  details?: Record<string, unknown>;
  cause?: unknown;
  statusCode?: number;
  retryable?: boolean;
}

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly statusCode: number;
  readonly details: Record<string, unknown> | undefined;
  readonly retryable: boolean;
  override readonly cause: unknown;

  constructor(code: ErrorCode, message: string, options: AppErrorOptions = {}) {
    super(message, options.cause === undefined ? undefined : { cause: options.cause });
    this.name = new.target.name;
    this.code = code;
    this.statusCode = options.statusCode ?? STATUS_BY_CODE[code];
    this.details = options.details;
    this.retryable = options.retryable ?? RETRYABLE_BY_CODE.has(code);
    this.cause = options.cause;
    Error.captureStackTrace?.(this, new.target);
  }

  toEnvelope(requestId?: string): ErrorEnvelope {
    return toEnvelopeFromCode(this.code, this.message, this.details, this.retryable, requestId);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: Record<string, unknown>, cause?: unknown) {
    super('validation_failed', message, {
      ...(details ? { details } : {}),
      ...(cause ? { cause } : {}),
    });
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super('not_found', id ? `${resource} '${id}' was not found` : `${resource} was not found`, {
      details: { resource, ...(id ? { id } : {}) },
    });
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication is required') {
    super('unauthorized', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'You do not have access to this resource') {
    super('forbidden', message);
  }
}

export class ConflictError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('conflict', message, { ...(details ? { details } : {}) });
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests', retryAfterSeconds?: number) {
    super('rate_limited', message, {
      ...(retryAfterSeconds === undefined ? {} : { details: { retryAfterSeconds } }),
    });
  }
}

/**
 * A provider exists but no credential was configured. This is deliberately NOT
 * an error the user caused: the UI renders it as "not set up yet", not as a
 * failure, so a fresh install is never full of red errors.
 */
export class ProviderNotConfiguredError extends AppError {
  readonly provider: string;
  constructor(provider: string, message?: string) {
    super(
      'provider_not_configured',
      message ??
        `The '${provider}' integration is not configured. Add its credentials to .env to enable it.`,
      { details: { provider } },
    );
    this.provider = provider;
  }
}

export class ProviderUnavailableError extends AppError {
  readonly provider: string;
  constructor(provider: string, message: string, cause?: unknown) {
    super('provider_unavailable', message, { details: { provider }, cause });
    this.provider = provider;
  }
}

/**
 * Raised when a request would breach the provider's terms — e.g. attempting to
 * export lyrics from a source whose licence forbids it. Never auto-retried.
 */
export class ProviderTermsViolationError extends AppError {
  readonly provider: string;
  constructor(provider: string, message: string, details?: Record<string, unknown>) {
    super('provider_terms_violation', message, {
      details: { provider, ...details },
      retryable: false,
    });
    this.provider = provider;
  }
}

export class StorageError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('storage_failure', message, { cause });
  }
}

export class QueueError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('queue_failure', message, { cause });
  }
}

export class TranscriptionError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('transcription_failed', message, { cause });
  }
}

export class RenderError extends AppError {
  constructor(message: string, cause?: unknown) {
    super('render_failed', message, { cause });
  }
}

export class UnsupportedMediaError extends AppError {
  constructor(message: string, details?: Record<string, unknown>) {
    super('unsupported_media', message, { ...(details ? { details } : {}) });
  }
}

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

function toEnvelopeFromCode(
  code: ErrorCode,
  message: string,
  details: Record<string, unknown> | undefined,
  retryable: boolean,
  requestId: string | undefined,
): ErrorEnvelope {
  return {
    error: {
      code,
      message,
      ...(details ? { details } : {}),
      retryable,
      ...(requestId ? { requestId } : {}),
    },
  };
}

/**
 * Build an envelope directly. Used by transport layers (Fastify, Next.js route
 * handlers) to wrap errors they catch that never became an `AppError`.
 */
export function createErrorEnvelope(
  code: ErrorCode,
  message: string,
  details?: Record<string, unknown>,
  retryable?: boolean,
  requestId?: string,
): ErrorEnvelope {
  return toEnvelopeFromCode(
    code,
    message,
    details,
    retryable ?? RETRYABLE_BY_CODE.has(code),
    requestId,
  );
}

/** Normalise anything thrown into a serialisable envelope. */
export function toErrorEnvelope(err: unknown, requestId?: string): ErrorEnvelope {
  if (isAppError(err)) {
    const base = err.toEnvelope(requestId);
    // Surface `cause` only when explicitly attached; it can carry internals.
    if (err.cause !== undefined && err.code === 'internal_error') {
      const causeText = err.cause instanceof Error ? err.cause.message : String(err.cause);
      return { error: { ...base.error, cause: causeText } };
    }
    return base;
  }

  if (err instanceof Error) {
    return toEnvelopeFromCode(
      'internal_error',
      'An unexpected error occurred',
      undefined,
      false,
      requestId,
    );
  }

  return toEnvelopeFromCode(
    'internal_error',
    'An unexpected error occurred',
    undefined,
    false,
    requestId,
  );
}
