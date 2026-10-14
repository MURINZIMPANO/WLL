import { missingEncoders, probeFfmpeg } from './ffmpeg.js';

/**
 * `pnpm --filter @lyriclens/render probe`
 *
 * Prints what the render service can actually do on this machine, so a missing
 * encoder is a one-line diagnosis rather than a failed export.
 */
const info = await probeFfmpeg();

if (!info.available) {
  console.error('ffmpeg was not found.');
  console.error(`  ${info.error ?? 'unknown error'}`);
  console.error('\nInstall it:');
  console.error('  winget install Gyan.FFmpeg          # Windows');
  console.error('  brew install ffmpeg                 # macOS');
  console.error('  sudo apt install ffmpeg             # Debian/Ubuntu');
  console.error('\nIf it is installed but not on PATH, set FFMPEG_PATH to the full path.');
  process.exit(1);
}

const missing = missingEncoders(info);

console.log(`ffmpeg ${info.version ?? '(unknown version)'} at ${info.path}`);
console.log(`encoders reported: ${info.encoders.length}`);

if (missing.length === 0) {
  console.log('All required encoders are present (libx264, aac).');
} else {
  console.error(`Missing encoders: ${missing.join(', ')}`);
  console.error('MP4 export will be unavailable until these are present.');
  process.exit(1);
}
