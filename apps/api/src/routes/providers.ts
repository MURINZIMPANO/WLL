import type { Env, ProviderTerms } from '@lyriclens/shared';
import type { FastifyInstance } from 'fastify';

/**
 * Integration status.
 *
 * LyricLens must be honest about what is and is not available: a page full of
 * red errors on a fresh install is a bad first impression, and pretending an
 * unconfigured provider works is worse. This endpoint is what Settings and the
 * "you can't do this yet" empty states read.
 */

export interface IntegrationStatus {
  id: string;
  displayName: string;
  /** Compiled into this build at all. */
  compiled: boolean;
  /** Has the credentials it needs. */
  configured: boolean;
  available: boolean;
  /** Present only when unavailable — a sentence fit for the UI. */
  reason?: string;
  /** Where to get the credentials, for the Settings screen. */
  docsUrl?: string;
  terms?: ProviderTerms;
}

/**
 * LRCLIB is the provider of record for synced lyrics and needs no key. Its
 * terms are recorded here so the export path can enforce them centrally
 * (see `mostRestrictiveTerms` and the exporter).
 */
export const LRCLIB_TERMS: ProviderTerms = {
  attributionRequired: true,
  attributionText: 'Lyrics from LRCLIB',
  maxDisplayLines: null,
  // LRCLIB publishes lyrics under CC0/BY licensing with attribution required;
  // user-initiated personal export of a fetched LRC is permitted.
  exportAllowed: true,
  exportFormats: ['lrc', 'srt', 'vtt', 'txt', 'png', 'mp4', 'csv'],
  cacheTtlSeconds: 86_400,
  redistributionAllowed: false,
};

const MUSIXMATCH_TERMS: ProviderTerms = {
  attributionRequired: true,
  attributionText: 'Lyrics from Musixmatch',
  maxDisplayLines: 500,
  exportAllowed: false,
  exportFormats: [],
  cacheTtlSeconds: 3_600,
  redistributionAllowed: false,
};

export function describeIntegrations(env: Env): IntegrationStatus[] {
  const statuses: IntegrationStatus[] = [];

  statuses.push({
    id: 'lrclib',
    displayName: 'LRCLIB',
    compiled: true,
    configured: true,
    available: true,
    terms: LRCLIB_TERMS,
  });

  const musixmatchConfigured =
    env.MUSIXMATCH_APP_ID !== undefined && env.MUSIXMATCH_APP_SECRET !== undefined;
  statuses.push({
    id: 'musixmatch',
    displayName: 'Musixmatch',
    compiled: false,
    configured: musixmatchConfigured,
    available: false,
    reason: musixmatchConfigured
      ? 'Credentials are present but the adapter ships in Phase 1. Lyrics come from LRCLIB until then.'
      : 'Optional. Requires a commercial Musixmatch licence — add MUSIXMATCH_APP_ID and MUSIXMATCH_APP_SECRET.',
    docsUrl: 'https://developer.musixmatch.com/',
    terms: MUSIXMATCH_TERMS,
  });

  const spotifyConfigured =
    env.SPOTIFY_CLIENT_ID !== undefined && env.SPOTIFY_CLIENT_SECRET !== undefined;
  statuses.push({
    id: 'spotify',
    displayName: 'Spotify',
    compiled: false,
    configured: spotifyConfigured,
    available: false,
    reason:
      'The Spotify adapter ships in Phase 1. Without it, use the desktop overlay, Identify song, or manual search.',
    docsUrl: 'https://developer.spotify.com/dashboard',
  });

  const recognitionReady =
    (env.SONG_RECOGNITION_PROVIDER === 'audd' && env.AUDD_API_TOKEN !== undefined) ||
    (env.SONG_RECOGNITION_PROVIDER === 'acrcloud' &&
      env.ACRCLOUD_API_KEY !== undefined &&
      env.ACRCLOUD_API_SECRET !== undefined);

  statuses.push({
    id: env.SONG_RECOGNITION_PROVIDER,
    displayName: 'Song recognition',
    compiled: false,
    configured: recognitionReady,
    available: false,
    reason: recognitionReady
      ? 'Credentials are present; the recognition adapter ships in Phase 1.'
      : 'Optional. Set SONG_RECOGNITION_PROVIDER to audd or acrcloud and add its API token.',
    docsUrl: 'https://dashboard.audd.io',
  });

  const subtitlesConfigured = env.OPENSUBTITLES_API_KEY !== undefined;
  statuses.push({
    id: 'opensubtitles',
    displayName: 'OpenSubtitles',
    compiled: false,
    configured: subtitlesConfigured,
    available: false,
    reason:
      'Optional, and needed only if you want to search public subtitle databases. User-supplied .srt/.vtt always work.',
    docsUrl: 'https://www.opensubtitles.com/en/consumers',
  });

  const pushConfigured = env.VAPID_PUBLIC_KEY !== undefined && env.VAPID_PRIVATE_KEY !== undefined;
  statuses.push({
    id: 'web_push',
    displayName: 'Web Push reminders',
    compiled: false,
    configured: pushConfigured,
    available: false,
    reason: pushConfigured
      ? 'VAPID keys are present; reminders ship in Phase 8.'
      : 'Generate a key pair with `npx web-push generate-vapid-keys` and set VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY.',
  });

  return statuses;
}

export function registerProviderRoutes(app: FastifyInstance, env: Env): void {
  app.get('/v1/providers', async () => ({ integrations: describeIntegrations(env) }));
}
