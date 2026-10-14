import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createHarness, HARNESS_HOOK_TIMEOUT_MS, type TestHarness } from './harness.js';

/**
 * One harness for the whole file: these are all read-only probes, and paying
 * for a fresh migration plus a temp directory on every test bought nothing but
 * hook timeouts.
 */
describe('API — routes', () => {
  let harness: TestHarness;

  beforeAll(async () => {
    harness = await createHarness();
    await harness.app.server.ready();
  }, HARNESS_HOOK_TIMEOUT_MS);

  afterAll(async () => {
    await harness.cleanup();
  }, HARNESS_HOOK_TIMEOUT_MS);

  describe('GET /v1/health', () => {
    it('reports ok with every subsystem checked', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/health' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.status).toBe('ok');
      expect(body.checks.database.ok).toBe(true);
      expect(body.checks.storage.ok).toBe(true);
      expect(body.checks.queue.ok).toBe(true);
      expect(body.checks.queue).toMatchObject({ queued: 0, running: 0, failed: 0 });
      expect(typeof body.uptimeMs).toBe('number');
    });

    it('reports whether media encryption is active', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/health' });
      // No MEDIA_ENCRYPTION_KEY in the test env, so uploads are plaintext.
      expect(response.json().checks.storage.encryption).toBe(false);
    });

    it('is never rate limited, even under load', async () => {
      const results = await Promise.all(
        Array.from({ length: 25 }, () =>
          harness.app.server.inject({ method: 'GET', url: '/v1/health' }),
        ),
      );
      expect(results.every((response) => response.statusCode === 200)).toBe(true);
    });
  });

  describe('GET /v1/flags', () => {
    it('returns every known flag with its effective value', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/flags' });

      expect(response.statusCode).toBe(200);
      const body = response.json();
      expect(body.names).toContain('pwa');
      expect(body.flags.music_overlay).toBe(true);
      // Not-yet-built surfaces must be off by default.
      expect(body.flags.pwa).toBe(false);
      expect(body.flags.learn_dashboard).toBe(false);
      expect(body.flags.exports).toBe(false);
    });

    it('exposes the code defaults alongside the effective values', async () => {
      const body = (await harness.app.server.inject({ method: 'GET', url: '/v1/flags' })).json();
      expect(body.defaults).toBeDefined();
      expect(Object.keys(body.defaults).sort()).toEqual([...body.names].sort());
    });

    it('looks up a single flag', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/flags/library' });
      expect(response.statusCode).toBe(200);
      expect(response.json()).toMatchObject({ flag: 'library', enabled: false });
    });

    it('404s an unknown flag rather than returning a false', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/flags/nope' });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('not_found');
      expect(body.error.details.known).toContain('pwa');
    });
  });

  describe('GET /v1/providers', () => {
    it('reports LRCLIB as available with its terms attached', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/providers' });
      const body = response.json();

      const lrclib = body.integrations.find((entry: { id: string }) => entry.id === 'lrclib');
      expect(lrclib).toBeDefined();
      expect(lrclib.available).toBe(true);
      expect(lrclib.terms.attributionRequired).toBe(true);
      expect(lrclib.terms.redistributionAllowed).toBe(false);
      expect(lrclib.terms.exportFormats).toContain('lrc');
    });

    it('is honest about unconfigured providers and says how to fix them', async () => {
      const body = (
        await harness.app.server.inject({ method: 'GET', url: '/v1/providers' })
      ).json();

      for (const entry of body.integrations.filter((e: { available: boolean }) => !e.available)) {
        expect(entry.reason, `${entry.id} must explain why it is unavailable`).toBeTruthy();
        expect(entry.reason.length).toBeGreaterThan(20);
      }
    });

    it('marks a credential-gated provider as unconfigured without credentials', async () => {
      const body = (
        await harness.app.server.inject({ method: 'GET', url: '/v1/providers' })
      ).json();
      const musixmatch = body.integrations.find(
        (entry: { id: string }) => entry.id === 'musixmatch',
      );
      expect(musixmatch.configured).toBe(false);
      expect(musixmatch.reason).toMatch(/MUSIXMATCH_APP_ID/);
    });

    it('refuses redistribution and limits exports for Musixmatch terms', async () => {
      const body = (
        await harness.app.server.inject({ method: 'GET', url: '/v1/providers' })
      ).json();
      const musixmatch = body.integrations.find(
        (entry: { id: string }) => entry.id === 'musixmatch',
      );
      expect(musixmatch.terms.exportAllowed).toBe(false);
      expect(musixmatch.terms.exportFormats).toEqual([]);
    });
  });

  describe('error contract', () => {
    it('returns the shared envelope for an unknown route', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/nope' });

      expect(response.statusCode).toBe(404);
      const body = response.json();
      expect(body.error.code).toBe('not_found');
      expect(body.error.retryable).toBe(false);
      expect(body.error.requestId).toBeTruthy();
      expect(body.error.message).toMatch(/GET \/v1\/nope/);
    });

    it('echoes a caller-supplied request id when it is a UUID', async () => {
      const requestId = '3f6b1a2c-9d4e-4f7a-8b1c-2d3e4f5a6b7c';
      const response = await harness.app.server.inject({
        method: 'GET',
        url: '/v1/health',
        headers: { 'x-request-id': requestId },
      });

      expect(response.headers['x-request-id']).toBe(requestId);
    });

    it('replaces a non-UUID request id so the log cannot be injected', async () => {
      const response = await harness.app.server.inject({
        method: 'GET',
        url: '/v1/health',
        headers: { 'x-request-id': 'evil\nInjected: yes' },
      });

      const echoed = String(response.headers['x-request-id']);
      expect(echoed).not.toContain('Injected');
      expect(echoed).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('generates a request id when none is supplied', async () => {
      const response = await harness.app.server.inject({ method: 'GET', url: '/v1/health' });
      expect(String(response.headers['x-request-id'])).toMatch(/^[0-9a-f-]{36}$/i);
    });

    it('returns a 400 envelope for a malformed JSON body', async () => {
      const response = await harness.app.server.inject({
        method: 'POST',
        url: '/v1/flags',
        headers: { 'content-type': 'application/json' },
        payload: '{ this is not json',
      });

      expect(response.statusCode).toBe(400);
      expect(response.json().error.code).toBe('bad_request');
      expect(response.json().error.retryable).toBe(false);
    });
  });
});
