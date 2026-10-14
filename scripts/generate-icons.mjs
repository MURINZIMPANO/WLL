/**
 * Generate the LyricLens app icons.
 *
 * Tauri needs real icon files for bundling. Rather than committing binaries we
 * cannot inspect, they are generated from the design tokens so they can never
 * drift from the palette: a lime sound-wave mark on the brand dark-green.
 *
 * Run with:  node scripts/generate-icons.mjs
 *
 * Writes PNGs for every platform plus a Windows .ico. The macOS .icns is
 * produced by `pnpm tauri icon` in Phase 8, which needs the full icon set.
 */

import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(HERE, '..');
const OUT_DIR = join(REPO_ROOT, 'apps/desktop/src-tauri/icons');

// Brand palette, mirrored from packages/ui/src/styles/tokens.css.
const BACKGROUND = [0x0e, 0x14, 0x0a];
const ACCENT = [0xc8, 0xf0, 0x3a];

/** CRC-32, needed by the PNG chunk format. */
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const typeAndData = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  return Buffer.concat([length, typeAndData, crc]);
}

function encodePng(width, height, rgba) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // colour type: RGBA
  ihdr[10] = 0; // deflate
  ihdr[11] = 0; // adaptive filtering
  ihdr[12] = 0; // no interlace

  // Each scanline is prefixed with filter byte 0 (None).
  const raw = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y += 1) {
    const rowStart = y * (width * 4 + 1);
    raw[rowStart] = 0;
    rgba.copy(raw, rowStart + 1, y * width * 4, (y + 1) * width * 4);
  }

  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/**
 * Draw the mark: rounded-square background with five rounded vertical bars of
 * varying height — an equaliser, matching the `equalizer` utility in the UI.
 */
function drawIcon(size) {
  const rgba = Buffer.alloc(size * size * 4);

  const radius = size * 0.22;
  const inset = size * 0.06;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const i = (y * size + x) * 4;

      // Rounded-rectangle coverage test.
      const dx = Math.max(inset + radius - x, 0, x - (size - inset - radius));
      const dy = Math.max(inset + radius - y, 0, y - (size - inset - radius));
      const inside = dx * dx + dy * dy <= radius * radius;

      rgba[i] = BACKGROUND[0];
      rgba[i + 1] = BACKGROUND[1];
      rgba[i + 2] = BACKGROUND[2];
      rgba[i + 3] = inside ? 255 : 0;
    }
  }

  const bars = [0.34, 0.62, 1.0, 0.76, 0.44];
  const barWidth = size * 0.072;
  const gap = size * 0.055;
  const totalWidth = bars.length * barWidth + (bars.length - 1) * gap;
  const left = (size - totalWidth) / 2;
  const centreY = size / 2;
  const maxHeight = size * 0.46;
  const barRadius = barWidth / 2;

  for (let index = 0; index < bars.length; index += 1) {
    const height = maxHeight * bars[index];
    const barX = left + index * (barWidth + gap);
    const top = centreY - height / 2;

    for (let y = Math.floor(top); y < top + height; y += 1) {
      for (let x = Math.floor(barX); x < barX + barWidth; x += 1) {
        if (x < 0 || y < 0 || x >= size || y >= size) continue;

        // Round the bar ends.
        const nearTop = y - top;
        const nearBottom = top + height - y;
        const capR = Math.min(nearTop, nearBottom);
        if (capR < barRadius) {
          const cx = x < barX + barRadius ? barX + barRadius : barX + barWidth - barRadius;
          const cy = nearTop < nearBottom ? top + barRadius : top + height - barRadius;
          const ddx = x - cx;
          const ddy = y - cy;
          if (ddx * ddx + ddy * ddy > barRadius * barRadius) continue;
        }

        const i = (y * size + x) * 4;
        if (rgba[i + 3] === 0) continue; // never draw outside the rounded square
        rgba[i] = ACCENT[0];
        rgba[i + 1] = ACCENT[1];
        rgba[i + 2] = ACCENT[2];
        rgba[i + 3] = 255;
      }
    }
  }

  return rgba;
}

/** Minimal single-image .ico wrapping PNG payloads (Vista+ format). */
function encodeIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: icon
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size; // width
    entry[1] = size >= 256 ? 0 : size; // height
    entry[2] = 0; // palette
    entry[3] = 0; // reserved
    entry.writeUInt16LE(1, 4); // colour planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    offset += data.length;
  }

  return Buffer.concat([header, ...entries, ...pngs.map((png) => png.data)]);
}

/**
 * Minimal .icns wrapping PNG payloads.
 *
 * Each entry is a four-character type plus its byte length, and the whole file
 * is the `icns` magic, a big-endian total length, then the entries. Only the
 * PNG-capable types are emitted, which every macOS version we target accepts.
 */
function encodeIcns(entries) {
  const header = Buffer.alloc(8);
  header.write('icns', 0, 'ascii');
  header.writeUInt32BE(8 + entries.reduce((sum, entry) => sum + 8 + entry.data.length, 0), 4);

  const chunks = entries.map(({ type, data }) => {
    const chunk = Buffer.alloc(8);
    chunk.write(type, 0, 'ascii');
    chunk.writeUInt32BE(8 + data.length, 4);
    return Buffer.concat([chunk, data]);
  });

  return Buffer.concat([header, ...chunks]);
}

mkdirSync(OUT_DIR, { recursive: true });

const SIZES = [32, 128, 256, 512];
const pngs = new Map();

for (const size of SIZES) {
  const png = encodePng(size, size, drawIcon(size));
  pngs.set(size, png);

  const name = size === 256 ? 'icon.png' : size === 512 ? '128x128@2x.png' : `${size}x${size}.png`;
  writeFileSync(join(OUT_DIR, name), png);
}

// 128x128@2x already written above as 512; also emit the plain 128.
writeFileSync(join(OUT_DIR, '128x128.png'), pngs.get(128));

const ico = encodeIco([
  { size: 32, data: pngs.get(32) },
  { size: 128, data: pngs.get(128) },
  { size: 256, data: pngs.get(256) },
]);
writeFileSync(join(OUT_DIR, 'icon.ico'), ico);

const icns = encodeIcns([
  { type: 'ic07', data: pngs.get(128) }, // 128x128
  { type: 'ic08', data: pngs.get(256) }, // 256x256
  { type: 'ic09', data: pngs.get(512) }, // 512x512
]);
writeFileSync(join(OUT_DIR, 'icon.icns'), icns);

console.log(`Wrote ${SIZES.length} PNGs, icon.ico and icon.icns to ${OUT_DIR}`);
