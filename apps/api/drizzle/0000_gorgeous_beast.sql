CREATE TABLE `jobs` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`state` text DEFAULT 'queued' NOT NULL,
	`payload_json` text NOT NULL,
	`result_json` text,
	`error` text,
	`attempts` integer DEFAULT 0 NOT NULL,
	`max_attempts` integer DEFAULT 3 NOT NULL,
	`progress` integer DEFAULT 0 NOT NULL,
	`idempotency_key` text,
	`worker_id` text,
	`heartbeat_at_ms` integer,
	`run_after_ms` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`started_at_ms` integer,
	`finished_at_ms` integer
);
--> statement-breakpoint
CREATE INDEX `jobs_state_runafter_idx` ON `jobs` (`state`,`run_after_ms`);--> statement-breakpoint
CREATE INDEX `jobs_kind_idx` ON `jobs` (`kind`,`state`);--> statement-breakpoint
CREATE UNIQUE INDEX `jobs_idempotency_idx` ON `jobs` (`idempotency_key`);--> statement-breakpoint
CREATE TABLE `playlist_items` (
	`id` text PRIMARY KEY NOT NULL,
	`playlist_id` text NOT NULL,
	`session_id` text NOT NULL,
	`position` integer DEFAULT 0 NOT NULL,
	`added_at_ms` integer NOT NULL,
	FOREIGN KEY (`playlist_id`) REFERENCES `playlists`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`session_id`) REFERENCES `sessions`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playlist_items_unique_idx` ON `playlist_items` (`playlist_id`,`session_id`);--> statement-breakpoint
CREATE INDEX `playlist_items_order_idx` ON `playlist_items` (`playlist_id`,`position`);--> statement-breakpoint
CREATE TABLE `playlists` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `playlists_user_idx` ON `playlists` (`user_id`);--> statement-breakpoint
CREATE TABLE `push_subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`endpoint` text NOT NULL,
	`p256dh` text NOT NULL,
	`auth` text NOT NULL,
	`user_agent` text,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `push_subscriptions_endpoint_idx` ON `push_subscriptions` (`endpoint`);--> statement-breakpoint
CREATE TABLE `refresh_tokens` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token_hash` text NOT NULL,
	`used_at_ms` integer,
	`revoked_at_ms` integer,
	`expires_at_ms` integer NOT NULL,
	`created_at_ms` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `refresh_tokens_hash_idx` ON `refresh_tokens` (`token_hash`);--> statement-breakpoint
CREATE INDEX `refresh_tokens_user_idx` ON `refresh_tokens` (`user_id`);--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`kind` text DEFAULT 'music' NOT NULL,
	`source` text DEFAULT 'manual_search' NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`title` text NOT NULL,
	`artist` text,
	`album` text,
	`cover_url` text,
	`duration_ms` integer,
	`lyrics_json` text,
	`lyrics_provider` text,
	`lyrics_unsynced` integer DEFAULT false NOT NULL,
	`lyrics_export_allowed` integer,
	`media_key` text,
	`media_bytes` integer,
	`subtitle_key` text,
	`language` text,
	`offset_ms` integer DEFAULT 0 NOT NULL,
	`favorite` integer DEFAULT false NOT NULL,
	`play_count` integer DEFAULT 0 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL,
	`last_played_at_ms` integer,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `sessions_user_idx` ON `sessions` (`user_id`);--> statement-breakpoint
CREATE INDEX `sessions_user_created_idx` ON `sessions` (`user_id`,`created_at_ms`);--> statement-breakpoint
CREATE INDEX `sessions_user_last_played_idx` ON `sessions` (`user_id`,`last_played_at_ms`);--> statement-breakpoint
CREATE INDEX `sessions_language_idx` ON `sessions` (`language`);--> statement-breakpoint
CREATE INDEX `sessions_favorite_idx` ON `sessions` (`user_id`,`favorite`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`avatar_url` text,
	`native_language` text DEFAULT 'en',
	`target_language` text DEFAULT 'es',
	`daily_goal_minutes` integer DEFAULT 10 NOT NULL,
	`created_at_ms` integer NOT NULL,
	`updated_at_ms` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_idx` ON `users` (`email`);