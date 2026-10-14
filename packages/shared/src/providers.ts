import type {
  LyricsSearchResult,
  NowPlayingSnapshot,
  RecognitionMatch,
  TrackIdentity,
} from './domain.js';
import type { LyricsDoc } from './lyrics.js';

/**
 * Provider adapter contracts.
 *
 * This module is the stable seam of the whole system: every external service is
 * reached through one of these interfaces, so swapping LRCLIB for Musixmatch,
 * or AudD for ACRCloud, touches exactly one adapter and nothing else.
 *
 * STABILITY CONTRACT (`@lyriclens/shared` is semver-versioned):
 *  - adding an optional method or optional property is a minor release;
 *  - removing or renaming anything, or changing a signature, is a major release
 *    and must ship with an adapter layer translating the old shape.
 */

/** Per-provider display/export limits, enforced centrally by the exporters. */
export interface ProviderTerms {
  /** The UI must render attribution alongside lyrics from this provider. */
  attributionRequired: boolean;
  /** Attribution string to display, if required. */
  attributionText?: string;
  /** Hard cap on lines shown in the scrolling view (null = unlimited). */
  maxDisplayLines: number | null;
  /** Whether this provider's licence permits the user to export at all. */
  exportAllowed: boolean;
  /** Which export formats are permitted for this provider. */
  exportFormats: readonly ExportFormat[];
  /** How long a fetched document may be reused before re-fetching. */
  cacheTtlSeconds: number;
  /** Almost always false — we never redistribute provider content. */
  redistributionAllowed: boolean;
}

export const EXPORT_FORMATS = ['lrc', 'srt', 'vtt', 'txt', 'png', 'mp4', 'csv'] as const;
export type ExportFormat = (typeof EXPORT_FORMATS)[number];

export interface ProviderIdentity {
  readonly id: string;
  readonly displayName: string;
  /** False when the adapter is compiled in but has no credentials configured. */
  readonly isAvailable: boolean;
  /** Human-readable reason shown in Settings > Integrations when unavailable. */
  readonly unavailableReason?: string;
}

/**
 * Reports what is playing in another application.
 *
 * Desktop implementations wrap SMTC / NowPlaying / MPRIS. Web implementations
 * wrap the Spotify Web API. A browser without Spotify cannot implement this —
 * that is a platform limit, not a gap, and the UI states it plainly.
 */
export interface NowPlayingProvider extends ProviderIdentity {
  start(): Promise<void>;
  stop(): Promise<void>;
  getSnapshot(): NowPlayingSnapshot | null;
  subscribe(listener: (snapshot: NowPlayingSnapshot) => void): () => void;
}

/** Fingerprints a short audio sample and returns candidate matches. */
export interface SongRecognitionProvider extends ProviderIdentity {
  /**
   * `fingerprint` is the provider's own payload (e.g. a base64 fingerprint for
   * ACRCloud, or a raw PCM buffer for AudD). Keeping it opaque means the engine
   * never has to know the wire format.
   */
  recognize(input: RecognitionInput): Promise<RecognitionMatch[]>;
}

export interface RecognitionInput {
  /** Opaque provider-specific audio payload. */
  fingerprint: string | Uint8Array;
  /** ISO 3166-1 alpha-2 country hint, improves accuracy for local charts. */
  countryCode?: string;
  timeoutMs?: number;
}

export interface LyricsQuery {
  title: string;
  artist: string;
  album?: string | null;
  durationMs?: number | null;
  limit?: number;
}

export interface LyricsProvider extends ProviderIdentity {
  readonly terms: ProviderTerms;
  search(query: LyricsQuery): Promise<LyricsSearchResult[]>;
  /** Returns null when the ref has no lyrics (an unsynced plain-text hit is valid). */
  fetchLyrics(ref: string): Promise<LyricsDoc | null>;
}

/** Subtitle sources for video: user files, OpenSubtitles, embedded tracks. */
export interface SubtitleProvider extends ProviderIdentity {
  readonly terms: ProviderTerms;
  search(query: SubtitleQuery): Promise<LyricsSearchResult[]>;
  fetchSubtitles(ref: string): Promise<LyricsDoc | null>;
}

export interface SubtitleQuery extends LyricsQuery {
  languageCode?: string;
  /** Only return subtitles whose duration is close to this, when known. */
  expectedDurationMs?: number | null;
}

export interface TranscriptionRequest {
  /** Absolute path or object-storage key of the media the service may read. */
  mediaRef: string;
  language?: string | null;
  /** "tiny" | "base" | "small" | "medium" — quality vs. speed. */
  modelSize?: 'tiny' | 'base' | 'small' | 'medium';
  /** Produce per-word timings (required for karaoke highlight). */
  wordLevelTimestamps?: boolean;
  onProgress?: (fraction: number) => void;
}

export interface TranscriptionResult {
  doc: LyricsDoc;
  language: string;
  durationMs: number;
}

export interface TranscriptionService extends ProviderIdentity {
  /** False when the Python service or the model weights are not installed yet. */
  isModelAvailable(): Promise<boolean>;
  transcribe(request: TranscriptionRequest): Promise<TranscriptionResult>;
}

export interface TranslationRequest {
  lines: string[];
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationResult {
  translations: string[];
  sourceLanguage: string;
  targetLanguage: string;
}

export interface TranslationService extends ProviderIdentity {
  translate(request: TranslationRequest): Promise<TranslationResult>;
}

export interface PronunciationRequest {
  /** Single word or short phrase. */
  text: string;
  language: string;
  referenceAudioRef?: string;
}

export interface PronunciationScore {
  /** 0..1 overall similarity to the reference. */
  overall: number;
  words: Array<{ word: string; score: number }>;
  feedback: string | null;
}

export interface PronunciationService extends ProviderIdentity {
  /** Reference pronunciation, synthesised if not supplied. */
  synthesize(request: PronunciationRequest): Promise<Uint8Array>;
  /** Scores a user recording captured by shadowing mode. */
  score(request: {
    referenceAudioRef: string;
    userAudio: Uint8Array;
    expectedText: string;
    language: string;
  }): Promise<PronunciationScore>;
}

export interface RenderRequest {
  /** Lyric document to burn in / animate. */
  doc: LyricsDoc;
  /** Optional user-supplied audio track. Commercial audio is never bundled. */
  audioRef?: string;
  output: 'mp4' | 'webm';
  width: number;
  height: number;
  fps: number;
  onProgress?: (fraction: number) => void;
}

export interface RenderResult {
  outputPath: string;
  durationMs: number;
  bytes: number;
}

export interface RenderService extends ProviderIdentity {
  /** True when an ffmpeg binary was found and is executable. */
  isReady(): Promise<boolean>;
  render(request: RenderRequest): Promise<RenderResult>;
}

/** Everything the API composes at boot; adapters register themselves here. */
export interface ProviderRegistry {
  nowPlaying: NowPlayingProvider[];
  recognition: SongRecognitionProvider[];
  lyrics: LyricsProvider[];
  subtitles: SubtitleProvider[];
  transcription: TranscriptionService[];
  translation: TranslationService[];
  pronunciation: PronunciationService[];
  render: RenderService[];
}

/**
 * The most restrictive terms across all lyrics providers. Applied to any
 * document whose provenance spans several providers (e.g. lyrics cached from
 * A, matched to a track found via B).
 */
export function mostRestrictiveTerms(terms: readonly ProviderTerms[]): ProviderTerms {
  if (terms.length === 0) {
    return {
      attributionRequired: true,
      maxDisplayLines: null,
      exportAllowed: false,
      exportFormats: [],
      cacheTtlSeconds: 3600,
      redistributionAllowed: false,
    };
  }

  const displayCaps = terms
    .map((term) => term.maxDisplayLines)
    .filter((cap): cap is number => cap !== null);

  const attribution = terms.find((term) => term.attributionRequired);

  return {
    attributionRequired: terms.some((term) => term.attributionRequired),
    ...(attribution?.attributionText !== undefined
      ? { attributionText: attribution.attributionText }
      : {}),
    maxDisplayLines: displayCaps.length > 0 ? Math.min(...displayCaps) : null,
    exportAllowed: terms.every((term) => term.exportAllowed),
    exportFormats: terms.every((term) => term.exportAllowed)
      ? [...new Set(terms.flatMap((term) => [...term.exportFormats]))]
      : [],
    cacheTtlSeconds: Math.min(...terms.map((term) => term.cacheTtlSeconds)),
    redistributionAllowed: terms.every((term) => term.redistributionAllowed),
  };
}

/** Identity key used to deduplicate cached tracks across providers. */
export function trackKey(track: Pick<TrackIdentity, 'title' | 'artist'>): string {
  return `${track.artist.trim().toLowerCase()}::${track.title.trim().toLowerCase()}`;
}
