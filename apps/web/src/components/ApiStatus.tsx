'use client';

import { useEffect, useState } from 'react';

interface HealthResponse {
  status: 'ok' | 'degraded';
  version: string;
  checks: {
    database: { ok: boolean };
    storage: { ok: boolean; encryption: boolean };
    queue: { ok: boolean; queued: number; running: number; failed: number };
  };
}

/**
 * Live API status.
 *
 * Reads `/v1/health` straight from the browser on the configured API origin.
 * This is the honest version of a status widget: it either shows the real
 * response or says it could not reach the API. It never renders invented data.
 */
export function ApiStatus() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const origin = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:4000';
    const controller = new AbortController();

    fetch(`${origin}/v1/health`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(`API returned ${response.status}`);
        setHealth((await response.json()) as HealthResponse);
        setError(null);
      })
      .catch((cause: unknown) => {
        if (cause instanceof DOMException && cause.name === 'AbortError') return;
        setError(`Could not reach the API at ${origin}. Start it with \`pnpm dev\`.`);
      });

    return () => {
      controller.abort();
    };
  }, []);

  if (error !== null) {
    return (
      <div className="rounded-card border border-danger/40 bg-danger-soft p-4">
        <p className="text-sm font-bold text-danger">API unreachable</p>
        <p className="mt-1 text-sm text-text-mid">{error}</p>
      </div>
    );
  }

  if (health === null) {
    return (
      <div className="rounded-card border border-border-subtle bg-surface p-4">
        <p className="text-sm text-text-mid">Checking the API…</p>
      </div>
    );
  }

  const items = [
    { label: 'Database', ok: health.checks.database.ok },
    { label: 'Storage', ok: health.checks.storage.ok },
    { label: 'Queue', ok: health.checks.queue.ok },
  ];

  return (
    <div className="rounded-card border border-border-subtle bg-surface p-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm font-bold text-text-high">
          API {health.status === 'ok' ? 'healthy' : 'degraded'}
        </p>
        <span className="rounded-pill bg-surface-glass px-2.5 py-0.5 text-xs font-semibold text-text-low">
          v{health.version}
        </span>
      </div>

      <ul className="mt-3 flex flex-wrap gap-2">
        {items.map((item) => (
          <li
            key={item.label}
            className="flex items-center gap-1.5 rounded-pill bg-surface-glass px-2.5 py-1 text-xs font-semibold text-text-mid"
          >
            <span
              aria-hidden
              className={`size-1.5 rounded-pill ${item.ok ? 'bg-success' : 'bg-danger'}`}
            />
            {item.label}
          </li>
        ))}
      </ul>

      {health.checks.storage.encryption === false && (
        <p className="mt-3 text-xs text-text-low">
          Media encryption is off. Set <code>MEDIA_ENCRYPTION_KEY</code> before storing real
          uploads.
        </p>
      )}
    </div>
  );
}
