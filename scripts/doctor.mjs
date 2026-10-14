/**
 * `pnpm doctor` — check the native prerequisites for this project.
 *
 * Prints one line per tool: found (with the version) or missing (with the
 * one-line install command for this OS). Exits non-zero when a tool that later
 * phases depend on is absent, so CI and a new contributor get the same answer.
 */

import { spawnSync } from 'node:child_process';
import { statfsSync } from 'node:fs';
import os from 'node:os';

const IS_WINDOWS = process.platform === 'win32';

const MINIMUM_FREE_GB = 2;

function capture(command, args) {
  const result = spawnSync(command, args, { encoding: 'utf8', timeout: 20_000, shell: IS_WINDOWS });
  if (result.error !== undefined || result.status !== 0) return null;
  return (result.stdout || '').trim() || (result.stderr || '').trim() || '';
}

const checks = [
  {
    name: 'Node.js',
    command: 'node',
    args: ['--version'],
    required: true,
    install: IS_WINDOWS
      ? 'winget install OpenJS.NodeJS.LTS'
      : 'brew install node   # macOS   |   sudo apt install nodejs npm   # Debian',
  },
  {
    name: 'pnpm',
    command: 'pnpm',
    args: ['--version'],
    required: true,
    install: 'corepack enable pnpm   # or:   npm i -g pnpm',
  },
  {
    name: 'Python (for services/speech)',
    // The `python` alias on Windows is often the Microsoft Store stub, which
    // exits 0 and does nothing. `py -3.11` is the reliable launcher.
    command: IS_WINDOWS ? 'py' : 'python3',
    args: IS_WINDOWS ? ['-3', '--version'] : ['--version'],
    required: false,
    install: IS_WINDOWS
      ? 'winget install Python.Python.3.11'
      : 'brew install python@3.11   # macOS   |   sudo apt install python3.11   # Debian',
  },
  {
    name: 'ffmpeg (for exports)',
    command: 'ffmpeg',
    args: ['-hide_banner', '-version'],
    required: false,
    install: IS_WINDOWS
      ? 'winget install Gyan.FFmpeg'
      : 'brew install ffmpeg   # macOS   |   sudo apt install ffmpeg   # Debian',
  },
  {
    name: 'Rust (for the desktop overlay)',
    command: 'rustc',
    args: ['--version'],
    required: false,
    install: IS_WINDOWS
      ? 'winget install Rustlang.Rustup   # then restart the shell'
      : "curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh",
  },
];

const GREEN = '[32m';
const YELLOW = '[33m';
const RED = '[31m';
const DIM = '[2m';
const RESET = '[0m';

console.log(`\nLyricLens doctor — ${os.platform()} ${os.arch()}, Node ${process.version}\n`);

let hardFailures = 0;
let softFailures = 0;

for (const check of checks) {
  const output = capture(check.command, check.args);

  if (output !== null) {
    const firstLine = output.split('\n')[0] || '';
    console.log(`  ${GREEN}ok${RESET}      ${check.name.padEnd(34)} ${DIM}${firstLine}${RESET}`);
  } else {
    if (check.required) hardFailures += 1;
    else softFailures += 1;
    const marker = check.required ? `${RED}missing${RESET}` : `${YELLOW}missing${RESET}`;
    console.log(`  ${marker}  ${check.name}`);
    console.log(`           ${DIM}${check.install}${RESET}`);
  }
}

// Disk space: pnpm's hardlinked store plus Next and Storybook output is not
// small, and running out mid-install is confusing.
try {
  const stats = statfsSync('.');
  const freeGb = (stats.bavail * stats.bsize) / 1024 ** 3;
  const ok = freeGb >= MINIMUM_FREE_GB;
  console.log(
    `  ${ok ? `${GREEN}ok${RESET}` : `${YELLOW}low${RESET}`}     ${'Free disk space'.padEnd(34)} ${DIM}${freeGb.toFixed(1)} GB (want ${MINIMUM_FREE_GB} GB+)${RESET}`,
  );
  if (!ok) softFailures += 1;
} catch {
  // statfs is unavailable on some filesystems; not worth failing over.
}

console.log('');

if (hardFailures > 0) {
  console.log(
    `${RED}${hardFailures} required tool(s) missing.${RESET} Run \`pnpm install\` after fixing them.\n`,
  );
  process.exit(1);
}

if (softFailures > 0) {
  console.log(
    `${YELLOW}${softFailures} optional tool(s) missing.${RESET} The features that need them will\n` +
      'report themselves as unavailable until installed — that is the designed behaviour.\n',
  );
} else {
  console.log(`${GREEN}Everything installed is available.${RESET}\n`);
}
