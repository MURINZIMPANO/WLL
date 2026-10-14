import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const run = promisify(execFile);

/**
 * FFmpeg discovery and capability probing.
 *
 * ffmpeg is a hard dependency for the export phase but an optional one
 * overall: LyricLens must run perfectly well for someone who only ever reads
 * lyrics. So the binary is probed once, reported on /health, and the absence of
 * it surfaces as a clear "not available yet" rather than a crash.
 *
 * `FFMPEG_PATH` overrides discovery — useful on Windows, where ffmpeg is often
 * installed somewhere not on PATH.
 */

export interface FfmpegInfo {
  available: boolean;
  path: string | null;
  version: string | null;
  /** Codecs the render service can rely on. */
  encoders: string[];
  error: string | null;
}

/** Encoders the lyric-video export depends on. */
export const REQUIRED_ENCODERS = ['libx264', 'aac'] as const;

export async function probeFfmpeg(
  binary = process.env['FFMPEG_PATH'] ?? 'ffmpeg',
): Promise<FfmpegInfo> {
  try {
    const { stdout } = await run(binary, ['-hide_banner', '-version'], {
      // A generous cap: ffmpeg -version can take a moment on a cold disk.
      timeout: 15_000,
      maxBuffer: 4 * 1024 * 1024,
    });

    const version = /version\s+(\S+)/.exec(stdout)?.[1] ?? null;

    const { stdout: encodersOut } = await run(binary, ['-hide_banner', '-encoders'], {
      timeout: 15_000,
      maxBuffer: 8 * 1024 * 1024,
    });

    const encoders = encodersOut
      .split('\n')
      .map((line) => /^\s*[VASFXBD.]{6}\s+(\S+)/.exec(line)?.[1])
      .filter((name): name is string => name !== undefined);

    return {
      available: true,
      path: binary,
      version,
      encoders,
      error: null,
    };
  } catch (error) {
    return {
      available: false,
      path: null,
      version: null,
      encoders: [],
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

export function missingEncoders(info: FfmpegInfo): string[] {
  return REQUIRED_ENCODERS.filter((required) => !info.encoders.includes(required));
}
