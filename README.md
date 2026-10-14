# LyricLens

Live, time-synced lyrics and subtitles — as a desktop overlay that floats over
any application, as an installable web app, and as a language-learning tool.

**Status: Phase 0 (foundation) complete.** See [Phase status](#phase-status).

---

## Requirements

| Tool            | Required?               | Install (one line)                  |
| --------------- | ----------------------- | ----------------------------------- |
| Node.js 22+     | **yes**                 | `winget install OpenJS.NodeJS.LTS`  |
| pnpm 10+        | **yes**                 | `corepack enable pnpm`              |
| ffmpeg          | for exports             | `winget install Gyan.FFmpeg`        |
| Python 3.9–3.13 | for transcription       | `winget install Python.Python.3.12` |
| Rust (stable)   | for the desktop overlay | `winget install Rustlang.Rustup`    |

Check what you have:

```bash
pnpm doctor
```

No Docker, no containers. Everything runs natively.

## Quick start

```bash
pnpm install
cp .env.example .env     # optional: everything runs without it
pnpm dev
```

`pnpm dev` checks the four ports it needs (3000, 1420, 4000, 4002) before
starting anything. If one is already taken it names the process holding it and
stops, rather than starting, crashing on `EADDRINUSE`, and taking the whole
stack down with it.

- Web app → <http://localhost:3000>
- Signed-in shell → <http://localhost:3000/app/dashboard>
- API → <http://localhost:4000> (`/v1/health`)
- Render service → <http://localhost:4002> (`/health`)
- Overlay UI (desktop window without the Tauri shell) → <http://localhost:1420>
- Design system → `pnpm storybook` → <http://localhost:6006>

The dashboard is a layout with placeholder data, labelled as such on screen.
Accounts, playlists and history land in Phase 4; the point of building it now
is that phase swaps data into a finished design rather than redesigning one.

Speech service (optional, needs Python):

```bash
pnpm speech:bootstrap        # core tier — HTTP surface only
pnpm speech:bootstrap:ml     # adds faster-whisper (~500MB, Phase 3)
```

Desktop overlay (optional, needs Rust):

```bash
pnpm --filter @lyriclens/desktop desktop:dev
```

## Configuration

Everything is optional. With an empty `.env` LyricLens runs with LRCLIB
(keyless synced lyrics) and manual search; integrations without credentials
report themselves as unavailable rather than failing.

See `.env.example` for every variable, with comments on where to obtain each
credential. Secrets are never committed — `.env` is gitignored.

| Variable                                | Needed for             | Where to get it                                                            |
| --------------------------------------- | ---------------------- | -------------------------------------------------------------------------- |
| `SPOTIFY_CLIENT_ID` / `_SECRET`         | Spotify Connect        | <https://developer.spotify.com/dashboard>                                  |
| `AUDD_API_TOKEN`                        | Identify song          | <https://dashboard.audd.io>                                                |
| `OPENSUBTITLES_API_KEY`                 | Public subtitle search | <https://www.opensubtitles.com/en/consumers>                               |
| `VAPID_PUBLIC_KEY` / `_PRIVATE_KEY`     | Web Push reminders     | `npx web-push generate-vapid-keys`                                         |
| `MEDIA_ENCRYPTION_KEY`                  | Encrypting uploads     | `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
| `JWT_ACCESS_SECRET` / `_REFRESH_SECRET` | Auth (Phase 4)         | `node -e "console.log(require('crypto').randomUUID())"`                    |

Production is strict: `loadEnv` refuses to start without the JWT secrets, the
media encryption key and secure cookies. Development is permissive.

## Commands

| Command                                 | What it does                                             |
| --------------------------------------- | -------------------------------------------------------- |
| `pnpm dev`                              | Checks ports, then runs API + web + render + overlay     |
| `pnpm verify`                           | The full CI gate locally: format, lint, typecheck, tests |
| `pnpm test`                             | Unit + integration tests across every package            |
| `pnpm build`                            | Builds every package                                     |
| `pnpm storybook`                        | The design-system catalogue                              |
| `pnpm doctor`                           | Native prerequisite check                                |
| `pnpm db:generate` / `db:migrate`       | Drizzle schema → SQL, then apply                         |
| `pnpm --filter @lyriclens/render probe` | Reports the local ffmpeg capabilities                    |
| `node scripts/generate-icons.mjs`       | Regenerates the Tauri icons from the tokens              |

`make <target>` mirrors the common ones (Git Bash / WSL).

## Repository layout

```
apps/
  web/         Next.js App Router — marketing site, PWA, dashboard, player
  api/         Fastify REST API, SQLite via libSQL, job queue, storage
  desktop/     Tauri overlay (Rust shell + the same React UI)
packages/
  ui/          Design system: tokens, components, Storybook
  sync-engine/ Playback/lyric state machine — one engine, three clients
  shared/      Contracts: provider interfaces, LRC/SRT/VTT codecs, flags, env
services/
  speech/      FastAPI + faster-whisper (transcription, alignment, scoring)
  render/      ffmpeg capability probe and, in Phase 5, lyric video rendering
```

Workspace packages ship **TypeScript source**, not build output. Next, Vite,
Vitest and tsup each transpile them directly, which removes a whole class of
"stale build artefact" bugs. Only the three deployables (`web`, `api`,
`desktop`) produce `dist`.

## Architecture notes

**One sync engine.** `packages/sync-engine` is the only place that turns a
playback position into a highlighted line. The overlay, the PWA player and
offline replay all drive the same `SyncEngine`; they differ only in which
`EngineSource` they supply (an OS media session, the Spotify API, or a local
`<audio>` element). Drift is anchored to a monotonic clock and interpolated
between provider readings, and a test asserts visible drift never exceeds 300 ms
against a once-per-second source.

**Provider adapters.** Every external service sits behind an interface in
`packages/shared/src/providers.ts` (`NowPlayingProvider`, `LyricsProvider`,
`SongRecognitionProvider`, `SubtitleProvider`, `TranscriptionService`,
`TranslationService`, `PronunciationService`, `RenderService`). Each lyrics
adapter carries a `ProviderTerms` record — attribution, display caps,
`exportAllowed` and permitted export formats — which the exporters enforce
centrally rather than trusting per-provider code.

**Local-first infrastructure.** SQLite through libSQL, a table-backed job queue,
and filesystem storage, each behind an interface with a hosted equivalent.
`DATABASE_URL` switches between `file:`, `libsql://` and `postgres://`;
`STORAGE_DRIVER` switches between `local` and `s3`. Relative `file:` paths
resolve against the **repository root**, never the working directory, so
`pnpm db:migrate` and `pnpm dev` cannot silently create two different databases.

**Design tokens.** `packages/ui/src/styles/tokens.css` is the single source of
truth, consumed unchanged by the web app, the desktop overlay and Storybook.
`packages/ui/test/contrast.test.ts` parses the shipped CSS and asserts WCAG AA
for every documented foreground/background pair, so a palette change that breaks
contrast fails the build rather than shipping. Two rules the suite now enforces
that it did not before: `--text-low` must clear 4.5:1 on **every** surface
including `--surface-2` (where MediaCard art sits), and control boundaries must
use `--border-strong` — `--border-subtle` measures ~1.25:1 and is a divider, not
a hit target.

**Tailwind content detection.** `packages/ui` ships TypeScript source, so every
consumer compiles the components itself. The stylesheet declares `@source` paths
relative to itself so Tailwind scans this package's classes; without them, every
utility used _only_ here is silently dropped from the app's CSS and the
components render unstyled while every story still passes.

**Feature flags.** Every surface added after the foundation sits behind a flag
that defaults to `false` (`packages/shared/src/feature-flags.ts`), overridable
per environment via `FEATURE_<NAME>`. The API exposes the effective values at
`/v1/flags` so a phase can be enabled in staging without a rebuild.

## Legal and data rules

- Lyrics come **only** from licensed providers through adapters. Lyric sites are
  never scraped.
- Covers and metadata come from the media session, the Spotify API, or
  MusicBrainz / Cover Art Archive.
- Subtitles come from OpenSubtitles or files you supply.
- Uploads are encrypted at rest when `MEDIA_ENCRYPTION_KEY` is set, are never
  used for training, and are hard-deletable by you.
- Exported lyric videos are visual-only, or use audio you supplied yourself.
  Commercial audio is never bundled or redistributed.

**Platform limits, stated plainly.** A web page cannot read another
application's playback — that is why the overlay is a desktop app, and why the
web app offers Spotify Connect, "Identify song" and manual search instead.
DRM-protected video cannot be captured; for such sources LyricLens uses official
embeddable players and caption APIs, and tells you plainly when a link cannot
be processed legally.

## Testing

```bash
pnpm test                       # everything
pnpm --filter @lyriclens/shared test
pnpm --filter @lyriclens/sync-engine test
```

Current suite: **325 tests** across five packages — 126 codec/contract tests,
63 sync-engine tests including the drift guarantee, 59 component tests plus 34
WCAG contrast checks, 68 API integration tests against a real SQLite file, and
5 ffmpeg probe tests.

API tests use a real database and a real temp directory rather than mocks: the
failure modes this project must never ship ("my data vanished") live exactly in
the seams a mock would hide. One consequence is that cleanup has to cope with
libSQL closing the database file handle on a background I/O thread — the
directory outlives `client.close()` by up to ~13s, so the harness waits for the
handle instead of racing it (`apps/api/test/harness.ts`, covered by
`apps/api/test/harness.test.ts`).

Playwright end-to-end tests and the Lighthouse audit arrive with the phases that
introduce the flows they cover (Phase 2 onward). CI runs typecheck, lint,
format, unit/integration tests, all builds, a real `cargo check`, and a guard
that fails if `apps/api/drizzle` drifts from the schema.

## Phase status

| Phase | Scope                                                                             | Status  |
| ----- | --------------------------------------------------------------------------------- | ------- |
| 0     | Monorepo, CI, database, design tokens, `packages/ui`, Storybook, sync engine, API | ✅ done |
| 1     | Music MVP — desktop overlay, Spotify Connect, Identify song, LRCLIB               | ⬜ next |
| 2     | PWA shell — manifest, service worker, offline, install UX, landing page           | ⬜      |
| 3     | Video mode — upload, Whisper pipeline, synced subtitles                           | ⬜      |
| 4     | Accounts, dashboard, library, offline replay                                      | ⬜      |
| 5     | Lyric Scene Player and export                                                     | ⬜      |
| 6     | Learn — translation, vocabulary, SRS, exercises                                   | ⬜      |
| 7     | Pronunciation — TTS, shadowing, scoring                                           | ⬜      |
| 8     | Polish — push reminders, a11y audit, installers                                   | ⬜      |

## Troubleshooting

**`pnpm dev` exits with "N port(s) already in use"** — a previous run is still
alive. The preflight prints the port, the pid and its command line; stop that
process and run `pnpm dev` again. `API_PORT` and `RENDER_PORT` can move a
service, but 3000 and 1420 are fixed by `next dev --port 3000` and by
`apps/desktop/vite.config.ts`.

**`ERR_PNPM_EPERM: operation not permitted, symlink`** — Windows Developer Mode
is off, so symlinks need administrator rights. `.npmrc` already sets
`node-linker=hoisted` to avoid this; if you removed it, put it back.

**API reports `storage.encryption: false`** — expected without
`MEDIA_ENCRYPTION_KEY`. Generate one before storing real uploads.

**The web app says "API unreachable"** — the API only sends CORS headers for
origins listed in `CORS_ORIGINS`, which is empty without a `.env`, so the
browser blocks `http://localhost:3000` from calling `http://localhost:4000`.
The status widget is reporting this correctly. Copy `.env.example` to `.env`
(the template already lists both local origins) or set the variable explicitly.

**Speech service says `faster-whisper is not installed`** — run
`pnpm speech:bootstrap:ml`. It also reports this on `/health`, so nothing else
breaks.

**Desktop overlay will not start** — `pnpm doctor` checks for Rust. Without it,
use `pnpm --filter @lyriclens/desktop dev` to work on the UI in a browser.

## Licence

Code is unlicensed for now. LyricLens bundles Manrope (SIL Open Font License
1.1); lyric content is never bundled — it is fetched from providers at runtime
under their own terms.
