/**
 * `pnpm dev` preflight.
 *
 * Every dev server binds a fixed port, so running the platform twice — or
 * leaving a previous run alive — used to produce three unrelated crash dumps
 * (`EADDRINUSE` from Next, from the render service, from the overlay's Vite
 * server) and then turbo tore down the tasks that *had* started. The API and the
 * web app died because the overlay could not bind 1420, which reads as "the
 * platform is broken" when nothing is wrong with it.
 *
 * So check first, name what is holding each port, and stop before anything
 * starts. Free ports are passed straight through to turbo.
 */

import { spawn, spawnSync } from 'node:child_process';
import net from 'node:net';

const IS_WINDOWS = process.platform === 'win32';

/**
 * Ports the dev stack needs, with the host each service actually binds so the
 * check matches reality rather than guessing.
 *
 * `API_PORT` and `RENDER_PORT` are read from the environment exactly as the
 * services read them. The web app and the overlay pass their ports on the
 * command line and in `vite.config.ts`, so they are fixed by design.
 */
const SERVICES = [
  { label: 'API', port: Number.parseInt(process.env.API_PORT ?? '4000', 10) },
  { label: 'web app', port: 3000, fixed: true },
  { label: 'render service', port: Number.parseInt(process.env.RENDER_PORT ?? '4002', 10) },
  { label: 'desktop overlay UI', port: 1420, fixed: true },
];

/** Resolves true when something accepts a TCP connection on `port`. */
function isListening(port) {
  return new Promise((resolve) => {
    // Try both loopback families: a listener on ::1 and one on 127.0.0.1 are
    // different sockets, and Next and Vite do not always pick the same one.
    const candidates = [
      { host: '127.0.0.1', family: 4 },
      { host: '::1', family: 6 },
    ];
    let pending = candidates.length;
    let busy = false;

    for (const { host, family } of candidates) {
      const socket = new net.Socket();
      const settle = (result) => {
        if (result) busy = true;
        pending -= 1;
        socket.destroy();
        if (pending === 0) resolve(busy);
      };

      socket.setTimeout(500);
      socket.once('connect', () => settle(true));
      socket.once('timeout', () => settle(false));
      socket.once('error', () => settle(false));
      socket.connect({ port, host, family });
    }
  });
}

/**
 * Best-effort lookup of the process holding a port.
 *
 * Purely for the error message — never fatal, and skipped entirely off Windows
 * so the check behaves the same everywhere.
 */
function processHolding(port) {
  if (!IS_WINDOWS) return null;

  // No `-p TCP` here: on Windows that filter silently drops every IPv6 socket,
  // which is exactly how the overlay's Vite server listens ([::1]:1420) and why
  // it used to report as an anonymous "already in use".
  const result = spawnSync('netstat', ['-ano'], { encoding: 'utf8', timeout: 10_000 });
  if (result.status !== 0 || typeof result.stdout !== 'string') return null;

  const rows = result.stdout.split('\n');
  for (const row of rows) {
    if (!/LISTENING/i.test(row)) continue;

    const columns = row.trim().split(/\s+/);
    // `TCP  [::1]:1420  [::]:0  LISTENING  32080` — the local address is column 1
    // and is bracketed when it is IPv6.
    const local = columns[1];
    const match = local === undefined ? null : /^(?:\[[^\]]*\]|[^:]*):(\d+)$/.exec(local);
    if (match === null || match[1] !== String(port)) continue;

    const pid = columns.at(-1);
    if (pid === undefined || !/^\d+$/.test(pid)) continue;
    return { pid, command: describeProcess(pid) };
  }

  return null;
}

/** The command line of a pid, trimmed to something readable in a terminal. */
function describeProcess(pid) {
  const detail = spawnSync(
    'powershell.exe',
    [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `(Get-CimInstance Win32_Process -Filter "ProcessId=${pid}").CommandLine`,
    ],
    { encoding: 'utf8', timeout: 15_000, windowsHide: true },
  );

  const command = (detail.stdout ?? '').trim().split('\n')[0] ?? '';
  return command.replace(/\s+/g, ' ').slice(0, 110);
}

const results = [];
for (const service of SERVICES) {
  results.push({ ...service, busy: await isListening(service.port) });
}

const busy = results.filter((result) => result.busy);

if (busy.length === 0) {
  const child = spawn('turbo', ['run', 'dev'], {
    stdio: 'inherit',
    shell: IS_WINDOWS,
    env: process.env,
  });
  child.on('exit', (code, signal) => {
    process.exit(signal !== null ? 1 : (code ?? 0));
  });
} else {
  const GREEN = '[32m';
  const RED = '[31m';
  const DIM = '[2m';
  const RESET = '[0m';

  console.log('\nLyricLens dev preflight\n');

  for (const result of results) {
    if (result.busy) {
      const owner = processHolding(result.port);
      console.log(
        `  ${RED}busy${RESET}    ${String(result.port).padEnd(6)} ${result.label.padEnd(20)} ` +
          `${DIM}${owner === null ? 'already in use' : `pid ${owner.pid}  ${owner.command}`}${RESET}`,
      );
    } else {
      console.log(
        `  ${GREEN}free${RESET}    ${String(result.port).padEnd(6)} ${result.label.padEnd(20)} ${DIM}ready${RESET}`,
      );
    }
  }

  console.log(
    `\n${RED}${busy.length} port(s) already in use, so \`pnpm dev\` would start and then\n` +
      'tear the whole stack down. Nothing is wrong with LyricLens.\n' +
      '\n' +
      'Close the other process (usually a previous `pnpm dev`) and try again.\n' +
      'Or move a service: API_PORT / RENDER_PORT in the environment.\n' +
      `${DIM}The web app (3000) and the overlay UI (1420) are fixed by their own\n` +
      `configuration and cannot be moved without editing the repo.${RESET}\n`,
  );

  process.exit(1);
}
