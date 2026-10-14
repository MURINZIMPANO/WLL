import { z } from 'zod';

import { LyricsDocSchema } from './lyrics.js';

/** Core domain vocabulary shared by every client, adapter and table. */

export const MEDIA_KINDS = ['music', 'video', 'speech'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

export const SESSION_SOURCES = [
  'desktop_media_session',
  'spotify',
  'recognition',
  'manual_search',
  'upload',
  'link',
  'import',
] as const;
export type SessionSource = (typeof SESSION_SOURCES)[number];

export const SESSION_STATUSES = ['pending', 'fetching', 'ready', 'failed'] as const;
export type SessionStatus = (typeof SESSION_STATUSES)[number];

export const TrackIdentitySchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().nullable().default(null),
  /** Seconds; null when the source does not report a duration. */
  durationMs: z.number().int().nonnegative().nullable().default(null),
  isrc: z.string().nullable().default(null),
  spotifyId: z.string().nullable().default(null),
  musicbrainzId: z.string().nullable().default(null),
  coverUrl: z.string().url().nullable().default(null),
});
export type TrackIdentity = z.infer<typeof TrackIdentitySchema>;

export const NowPlayingSnapshotSchema = z.object({
  track: TrackIdentitySchema,
  positionMs: z.number().int().nonnegative(),
  durationMs: z.number().int().nonnegative().nullable(),
  playing: z.boolean(),
  source: z.enum(SESSION_SOURCES),
  coverUrl: z.string().url().nullable(),
  /** Monotonic timestamp (performance.now domain) when the reading was taken. */
  capturedAtMs: z.number().nonnegative(),
  providerId: z.string().min(1),
});
export type NowPlayingSnapshot = z.infer<typeof NowPlayingSnapshotSchema>;

export const RecognitionMatchSchema = z.object({
  title: z.string().min(1),
  artist: z.string().min(1),
  album: z.string().nullable().default(null),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  coverUrl: z.string().url().nullable().default(null),
  isrc: z.string().nullable().default(null),
  providerId: z.string().min(1),
  /** Provider confidence, 0..1. */
  score: z.number().min(0).max(1).default(0),
});
export type RecognitionMatch = z.infer<typeof RecognitionMatchSchema>;

export const LyricsSearchResultSchema = z.object({
  providerId: z.string().min(1),
  /** Opaque, provider-specific reference handed back to `fetchLyrics`. */
  ref: z.string().min(1),
  title: z.string(),
  artist: z.string(),
  album: z.string().nullable().default(null),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  synced: z.boolean(),
  coverUrl: z.string().url().nullable().default(null),
});
export type LyricsSearchResult = z.infer<typeof LyricsSearchResultSchema>;

export const SessionSummarySchema = z.object({
  id: z.string().min(1),
  kind: z.enum(MEDIA_KINDS),
  source: z.enum(SESSION_SOURCES),
  status: z.enum(SESSION_STATUSES),
  title: z.string(),
  artist: z.string().nullable().default(null),
  coverUrl: z.string().url().nullable().default(null),
  durationMs: z.number().int().nonnegative().nullable().default(null),
  lyrics: LyricsDocSchema.nullable().default(null),
  offsetMs: z.number().int().default(0),
  providerId: z.string().nullable().default(null),
  favorite: z.boolean().default(false),
  playCount: z.number().int().nonnegative().default(0),
  /** BCP-47 tag detected or declared for the content; drives Learn filtering. */
  language: z.string().nullable().default(null),
  createdAtMs: z.number().int().nonnegative(),
  lastPlayedAtMs: z.number().int().nonnegative().nullable().default(null),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export function mediaKindForSource(source: SessionSource): MediaKind {
  switch (source) {
    case 'upload':
    case 'link':
      return 'video';
    case 'desktop_media_session':
    case 'spotify':
    case 'recognition':
    case 'manual_search':
      return 'music';
    case 'import':
      return 'speech';
  }
}
