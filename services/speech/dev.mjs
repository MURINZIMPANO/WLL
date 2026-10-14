/**
 * Guard for the speech service's dev script.
 *
 * The service needs a Python virtualenv, which is a deliberate manual step
 * (`pnpm speech:bootstrap`). Without this guard, `pnpm dev` would start
 * services/speech, immediately fail on the missing interpreter, and take the
 * API, web and render servers down with it — turbo stops the whole run when
 * one persistent task exits.
 *
 * So: no venv is not an error. It is the designed degraded state, and the
 * rest of LyricLens keeps working without it.
 */

import { existsSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const isWindows = process.platform === 'win32';

const python = isWindows
  ? join(here, '.venv', 'Scripts', 'python.exe')
  : join(here, '.venv', 'bin', 'python');

if (!existsSync(python)) {
  console.log(
    [
      '',
      '  @lyriclens/speech — not started.',
      '',
      '  Transcription needs a Python virtualenv, which is a one-off setup step:',
      '',
      '      pnpm speech:bootstrap      # HTTP surface only (~30MB)',
      '      pnpm speech:bootstrap:ml   # adds faster-whisper (~500MB)',
      '',
      '  Everything else — the overlay UI, the API, lyrics and subtitles —',
      '  works without it. This task is idle, not failed.',
      '',
    ].join('\n'),
  );
  process.exit(0);
}

const child = spawn(
  python,
  ['-m', 'uvicorn', 'app.main:app', '--reload', '--port', process.env.SPEECH_PORT ?? '4001'],
  { cwd: here, stdio: 'inherit', shell: isWindows },
);

child.on('exit', (code) => {
  process.exit(code ?? 0);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => {
    child.kill();
  });
}
