/**
 * Timestamp parsing and formatting.
 *
 * LyricLens uses integer **milliseconds** as the single internal time unit.
 * Every codec (LRC, SRT, VTT) converts at its own boundary, so the sync engine
 * never has to care which format a track arrived in.
 */

/**
 * Parse `mm:ss`, `mm:ss.x`, `mm:ss.xx`, `mm:ss.xxx`, `hh:mm:ss`, `hh:mm:ss.xxx`,
 * and the comma-decimal variants SubRip uses. Returns milliseconds, or `null`
 * when the input is not a valid timestamp.
 */
export function parseClockTimestamp(raw: string): number | null {
  const value = raw.trim();
  if (value === '') return null;

  const parts = value.split(':');
  if (parts.length < 2 || parts.length > 3) return null;

  // Only the final component may carry a fractional part.
  let fractionText: string | null = null;
  const numericParts: number[] = [];

  for (let i = 0; i < parts.length; i += 1) {
    const part = parts[i];
    if (part === undefined || part === '') return null;

    let whole = part;
    if (i === parts.length - 1) {
      // SRT uses a comma decimal separator; accept both, never both on one value.
      const dot = part.search(/[.,]/);
      if (dot !== -1) {
        whole = part.slice(0, dot);
        fractionText = part.slice(dot + 1);
        if (fractionText === '' || !/^\d+$/.test(fractionText)) return null;
      }
    }

    if (whole === '' || !/^\d+$/.test(whole)) return null;
    numericParts.push(Number.parseInt(whole, 10));
  }

  const hasHours = parts.length === 3;
  const hours = hasHours ? (numericParts[0] ?? 0) : 0;
  const minutes = hasHours ? (numericParts[1] ?? 0) : (numericParts[0] ?? 0);
  const seconds = hasHours ? (numericParts[2] ?? 0) : (numericParts[1] ?? 0);

  // ".5" is 500ms, ".05" is 50ms, ".1234" truncates to 123ms.
  const millis =
    fractionText === null ? 0 : Number.parseInt(fractionText.padEnd(3, '0').slice(0, 3), 10);

  return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis;
}

function pad(value: number, width: number): string {
  return value.toString().padStart(width, '0');
}

/**
 * `[mm:ss.xx]` (default) or `[mm:ss.xxx]`. Hours appear only when non-zero.
 * Rounding happens once, *before* decomposition, so 59.995s carries correctly
 * into the next minute instead of emitting an invalid `:60.00`.
 */
export function formatLrcTimestamp(ms: number, fractionDigits: 2 | 3 = 2): string {
  const divisor = fractionDigits === 3 ? 1 : 10;
  const safe = Math.max(0, Math.round(ms / divisor) * divisor);

  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const fraction = pad(Math.floor((safe % 1000) / divisor), fractionDigits);

  const clock =
    hours > 0
      ? `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)}`
      : `${pad(minutes, 2)}:${pad(seconds, 2)}`;

  return `[${clock}.${fraction}]`;
}

/** `00:00:01,000` — SRT always uses a comma decimal separator. */
export function formatSrtTimestamp(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${pad(hours, 2)}:${pad(minutes, 2)}:${pad(seconds, 2)},${pad(safe % 1000, 3)}`;
}

/** `00:00:01.000` — WebVTT uses a dot. */
export function formatVttTimestamp(ms: number): string {
  return formatSrtTimestamp(ms).replace(',', '.');
}

export function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

/** `3:07` — elapsed / total readouts in the player. */
export function formatDuration(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  return `${Math.floor(totalSeconds / 60)}:${pad(totalSeconds % 60, 2)}`;
}

/** `1h 02m`, `12m 30s`, `48s` — library cards and session rows. */
export function formatDurationHuman(ms: number): string {
  const safe = Math.max(0, Math.round(ms));
  const totalSeconds = Math.floor(safe / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) return `${hours}h ${pad(minutes, 2)}m`;
  if (minutes > 0) return `${minutes}m ${pad(seconds, 2)}s`;
  return `${seconds}s`;
}
