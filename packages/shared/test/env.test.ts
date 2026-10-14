import { describe, expect, it } from 'vitest';

import { loadEnv, parseCorsOrigins } from '../src/env.js';
import {
  ProviderNotConfiguredError,
  ValidationError,
  isAppError,
  toErrorEnvelope,
} from '../src/errors.js';

describe('loadEnv', () => {
  it('boots with an empty environment', () => {
    const { env } = loadEnv({});
    expect(env.NODE_ENV).toBe('development');
    expect(env.API_PORT).toBe(4000);
    expect(env.DATABASE_URL).toBe('file:./var/lyriclens.db');
    expect(env.STORAGE_DRIVER).toBe('local');
    expect(env.LRCLIB_BASE_URL).toBe('https://lrclib.net/api');
  });

  it('coerces numeric ports from strings', () => {
    const { env } = loadEnv({ API_PORT: '5555', MAX_UPLOAD_MB: '512' });
    expect(env.API_PORT).toBe(5555);
    expect(env.MAX_UPLOAD_MB).toBe(512);
  });

  it('treats an empty string as "not set" rather than 0', () => {
    const { env } = loadEnv({ API_PORT: '', S3_BUCKET: '' });
    expect(env.API_PORT).toBe(4000);
    expect(env.S3_BUCKET).toBeUndefined();
  });

  it('parses booleanish values', () => {
    expect(loadEnv({ COOKIE_SECURE: 'true' }).env.COOKIE_SECURE).toBe(true);
    expect(loadEnv({ COOKIE_SECURE: '0' }).env.COOKIE_SECURE).toBe(false);
    expect(loadEnv({ LOG_PRETTY: '' }).env.LOG_PRETTY).toBe(true);
  });

  it('rejects an invalid enum instead of silently defaulting', () => {
    expect(() => loadEnv({ LOG_LEVEL: 'loud' })).toThrow(/Invalid environment/);
    expect(() => loadEnv({ STORAGE_DRIVER: 'ftp' })).toThrow(/Invalid environment/);
  });

  it('rejects a non-numeric port', () => {
    expect(() => loadEnv({ API_PORT: 'not-a-port' })).toThrow(/API_PORT/);
  });

  it('lists every problem at once rather than stopping at the first', () => {
    let message = '';
    try {
      loadEnv({ API_PORT: 'x', LOG_LEVEL: 'loud', NODE_ENV: 'production' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toContain('API_PORT');
    expect(message).toContain('LOG_LEVEL');
    expect(message).toContain('JWT_ACCESS_SECRET');
  });

  it('notes when an opted-in provider has no credentials', () => {
    const { notes } = loadEnv({ SONG_RECOGNITION_PROVIDER: 'audd' });
    expect(notes.join(' ')).toMatch(/AUDD_API_TOKEN is empty/);
  });

  it('warns about unencrypted uploads outside production', () => {
    expect(loadEnv({ NODE_ENV: 'development' }).notes.join(' ')).toMatch(/unencrypted/);
  });

  it('requires secrets, encryption and secure cookies in production', () => {
    let message = '';
    try {
      loadEnv({ NODE_ENV: 'production' });
    } catch (error) {
      message = error instanceof Error ? error.message : '';
    }
    expect(message).toContain('JWT_ACCESS_SECRET is required in production');
    expect(message).toContain('MEDIA_ENCRYPTION_KEY is required in production');
    expect(message).toContain('COOKIE_SECURE must be true in production');
  });

  it('accepts a fully specified production environment', () => {
    const { env } = loadEnv({
      NODE_ENV: 'production',
      JWT_ACCESS_SECRET: 'a'.repeat(32),
      JWT_REFRESH_SECRET: 'b'.repeat(32),
      MEDIA_ENCRYPTION_KEY: 'c'.repeat(64),
      VAPID_PUBLIC_KEY: 'pub',
      VAPID_PRIVATE_KEY: 'priv',
      COOKIE_SECURE: 'true',
    });
    expect(env.NODE_ENV).toBe('production');
  });
});

describe('parseCorsOrigins', () => {
  it('splits, trims and de-duplicates', () => {
    expect(parseCorsOrigins('http://a.test, http://b.test ,http://a.test')).toEqual([
      'http://a.test',
      'http://b.test',
    ]);
  });

  it('returns an empty list for missing input', () => {
    expect(parseCorsOrigins(undefined)).toEqual([]);
    expect(parseCorsOrigins('  ')).toEqual([]);
  });
});

describe('error envelope', () => {
  it('maps codes to sensible HTTP statuses', () => {
    expect(new ValidationError('bad').statusCode).toBe(422);
    expect(new ProviderNotConfiguredError('audd').statusCode).toBe(501);
  });

  it('serialises an AppError with retryability', () => {
    const envelope = toErrorEnvelope(new ValidationError('nope', { field: 'title' }), 'req-1');
    expect(envelope.error.code).toBe('validation_failed');
    expect(envelope.error.message).toBe('nope');
    expect(envelope.error.details).toEqual({ field: 'title' });
    expect(envelope.error.retryable).toBe(false);
    expect(envelope.error.requestId).toBe('req-1');
  });

  it('marks a not-configured provider as a setup state, not a failure', () => {
    const envelope = toErrorEnvelope(new ProviderNotConfiguredError('audd'));
    expect(envelope.error.code).toBe('provider_not_configured');
    expect(envelope.error.details).toEqual({ provider: 'audd' });
    expect(envelope.error.message).toMatch(/not configured/);
  });

  it('never leaks a raw internal message or stack to the client', () => {
    const envelope = toErrorEnvelope(new Error('connection string postgres://user:pw@host/db'));
    expect(envelope.error.message).toBe('An unexpected error occurred');
    expect(envelope.error.cause).toBeUndefined();
    expect(JSON.stringify(envelope)).not.toContain('postgres://');
  });

  it('normalises non-Error throwables', () => {
    expect(toErrorEnvelope('a string').error.code).toBe('internal_error');
    expect(toErrorEnvelope(undefined).error.code).toBe('internal_error');
  });

  it('identifies AppError instances', () => {
    expect(isAppError(new ValidationError('x'))).toBe(true);
    expect(isAppError(new Error('x'))).toBe(false);
  });
});
