import { sqliteTable, text, integer, index, uniqueIndex } from 'drizzle-orm/sqlite-core';

/**
 * LyricLens schema — Phase 0 baseline.
 *
 * MIGRATION RULES (enforced by CI review, not by tooling):
 *  - Additive only. Never drop or rename a column in the same release that
 *    stops reading it. Expand first, migrate, contract in a later release.
 *  - Every table has `created_at_ms` / `updated_at_ms` as INTEGER epoch-ms.
 *    No SQLite DATETIME: epoch integers are portable to Postgres unchanged and
 *    immune to timezone ambiguity.
 *  - Money, durations and drift are integers or fixed-precision reals only.
 *  - Provider terms are stored per row, never assumed globally, so a provider
 *    can change its licence without a migration.
 *
 * Portability: the column types below map 1:1 onto Postgres bigint/text/double.
 * Moving to hosted Postgres means changing `drizzle-orm/sqlite-core` to
 * `drizzle-orm/pg-core` in this file and the driver in `db/client.ts` — the
 * application code never names a dialect.
 */

const now = () => Date.now();

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    /** BCP-47. */
    nativeLanguage: text('native_language').default('en'),
    targetLanguage: text('target_language').default('es'),
    /** Daily review goal, set in Learn. */
    dailyGoalMinutes: integer('daily_goal_minutes').notNull().default(10),
    createdAtMs: integer('created_at_ms').notNull().$defaultFn(now),
    updatedAtMs: integer('updated_at_ms').notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex('users_email_idx').on(table.email)],
);

export const sessions = sqliteTable(
  'sessions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    kind: text('kind', { enum: ['music', 'video', 'speech'] })
      .notNull()
      .default('music'),
    source: text('source', {
      enum: [
        'desktop_media_session',
        'spotify',
        'recognition',
        'manual_search',
        'upload',
        'link',
        'import',
      ],
    })
      .notNull()
      .default('manual_search'),
    status: text('status', { enum: ['pending', 'fetching', 'ready', 'failed'] })
      .notNull()
      .default('pending'),

    title: text('title').notNull(),
    artist: text('artist'),
    album: text('album'),
    coverUrl: text('cover_url'),
    durationMs: integer('duration_ms'),

    /**
     * The lyric document is stored inline. It is small (a few KB of text) and
     * this makes offline replay a single query with no join and no cache
     * invalidation problem.
     */
    lyricsJson: text('lyrics_json'),
    lyricsProvider: text('lyrics_provider'),
    /** True when lyrics exist but carry no timings. */
    lyricsUnsynced: integer('lyrics_unsynced', { mode: 'boolean' }).notNull().default(false),
    /**
     * Per-provider export permission captured at fetch time. Null means "not
     * determined" and is treated as *not* exportable — deny by default.
     */
    lyricsExportAllowed: integer('lyrics_export_allowed', { mode: 'boolean' }),

    /** Key of the uploaded media in the storage driver, if any. */
    mediaKey: text('media_key'),
    mediaBytes: integer('media_bytes'),
    subtitleKey: text('subtitle_key'),

    /** BCP-47, detected or declared. Drives the Learn filters. */
    language: text('language'),
    /** Per-session sync nudge in ms. Applied at playback time, never baked in. */
    offsetMs: integer('offset_ms').notNull().default(0),

    favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
    playCount: integer('play_count').notNull().default(0),

    createdAtMs: integer('created_at_ms').notNull().$defaultFn(now),
    updatedAtMs: integer('updated_at_ms').notNull().$defaultFn(now),
    lastPlayedAtMs: integer('last_played_at_ms'),
  },
  (table) => [
    index('sessions_user_idx').on(table.userId),
    index('sessions_user_created_idx').on(table.userId, table.createdAtMs),
    index('sessions_user_last_played_idx').on(table.userId, table.lastPlayedAtMs),
    index('sessions_language_idx').on(table.language),
    index('sessions_favorite_idx').on(table.userId, table.favorite),
  ],
);

export const playlists = sqliteTable(
  'playlists',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    description: text('description'),
    createdAtMs: integer('created_at_ms').notNull().$defaultFn(now),
    updatedAtMs: integer('updated_at_ms').notNull().$defaultFn(now),
  },
  (table) => [index('playlists_user_idx').on(table.userId)],
);

export const playlistItems = sqliteTable(
  'playlist_items',
  {
    id: text('id').primaryKey(),
    playlistId: text('playlist_id')
      .notNull()
      .references(() => playlists.id, { onDelete: 'cascade' }),
    sessionId: text('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),
    position: integer('position').notNull().default(0),
    addedAtMs: integer('added_at_ms').notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex('playlist_items_unique_idx').on(table.playlistId, table.sessionId),
    index('playlist_items_order_idx').on(table.playlistId, table.position),
  ],
);

export const jobs = sqliteTable(
  'jobs',
  {
    id: text('id').primaryKey(),
    kind: text('kind', { enum: ['transcribe', 'render', 'translate', 'pronounce'] }).notNull(),
    state: text('state', { enum: ['queued', 'running', 'succeeded', 'failed', 'cancelled'] })
      .notNull()
      .default('queued'),
    payloadJson: text('payload_json').notNull(),
    resultJson: text('result_json'),
    error: text('error'),

    attempts: integer('attempts').notNull().default(0),
    maxAttempts: integer('max_attempts').notNull().default(3),
    progress: integer('progress').notNull().default(0),

    /** Dedupe key: at most one live job per value. */
    idempotencyKey: text('idempotency_key'),
    workerId: text('worker_id'),
    heartbeatAtMs: integer('heartbeat_at_ms'),
    /** Earliest time the job may be claimed again (backoff). */
    runAfterMs: integer('run_after_ms').notNull().default(0),

    createdAtMs: integer('created_at_ms').notNull().$defaultFn(now),
    startedAtMs: integer('started_at_ms'),
    finishedAtMs: integer('finished_at_ms'),
  },
  (table) => [
    index('jobs_state_runafter_idx').on(table.state, table.runAfterMs),
    index('jobs_kind_idx').on(table.kind, table.state),
    uniqueIndex('jobs_idempotency_idx').on(table.idempotencyKey),
  ],
);

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    /** SHA-256 of the token. The raw value is never stored. */
    tokenHash: text('token_hash').notNull(),
    /** Rotation: when this token is used, its row is marked used and a new one issued. */
    usedAtMs: integer('used_at_ms'),
    revokedAtMs: integer('revoked_at_ms'),
    expiresAtMs: integer('expires_at_ms').notNull(),
    createdAtMs: integer('created_at_ms').notNull().$defaultFn(now),
  },
  (table) => [
    uniqueIndex('refresh_tokens_hash_idx').on(table.tokenHash),
    index('refresh_tokens_user_idx').on(table.userId),
  ],
);

export const pushSubscriptions = sqliteTable(
  'push_subscriptions',
  {
    id: text('id').primaryKey(),
    userId: text('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    endpoint: text('endpoint').notNull(),
    p256dh: text('p256dh').notNull(),
    auth: text('auth').notNull(),
    userAgent: text('user_agent'),
    createdAtMs: integer('created_at_ms').notNull().$defaultFn(now),
  },
  (table) => [uniqueIndex('push_subscriptions_endpoint_idx').on(table.endpoint)],
);

export const schema = {
  users,
  sessions,
  playlists,
  playlistItems,
  jobs,
  refreshTokens,
  pushSubscriptions,
};

export type UserRow = typeof users.$inferSelect;
export type SessionRow = typeof sessions.$inferSelect;
export type JobRow = typeof jobs.$inferSelect;
