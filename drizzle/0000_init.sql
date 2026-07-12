CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` text,
	`refresh_token_expires_at` text,
	`scope` text,
	`password` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_account_user` ON `account` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_account_provider` ON `account` (`provider_id`,`account_id`);--> statement-breakpoint
CREATE TABLE `assistant_usage` (
	`user_id` text NOT NULL,
	`bucket` text NOT NULL,
	`count` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `bucket`)
);
--> statement-breakpoint
CREATE TABLE `conference_teams` (
	`league` text NOT NULL,
	`conference_id` text NOT NULL,
	`team_id` text NOT NULL,
	PRIMARY KEY(`league`, `conference_id`, `team_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_conf_teams` ON `conference_teams` (`league`,`conference_id`);--> statement-breakpoint
CREATE TABLE `conferences` (
	`league` text NOT NULL,
	`id` text NOT NULL,
	`name` text NOT NULL,
	`short_name` text,
	`sort` integer,
	PRIMARY KEY(`league`, `id`)
);
--> statement-breakpoint
CREATE TABLE `expert_notes` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`target_id` text NOT NULL,
	`section` text NOT NULL,
	`body` text NOT NULL,
	`source_url` text,
	`source_quote` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_expert_notes_target` ON `expert_notes` (`scope`,`target_id`);--> statement-breakpoint
CREATE TABLE `follows` (
	`follower_id` text NOT NULL,
	`followee_id` text NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`follower_id`, `followee_id`),
	FOREIGN KEY (`follower_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`followee_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_follows_followee` ON `follows` (`followee_id`);--> statement-breakpoint
CREATE TABLE `games` (
	`league` text NOT NULL,
	`id` text NOT NULL,
	`date` text NOT NULL,
	`season` integer,
	`season_type` integer,
	`state` text,
	`detail` text,
	`completed` integer,
	`name` text,
	`short_name` text,
	`venue_id` text,
	`venue_name` text,
	`venue_city` text,
	`venue_state` text,
	`home_team_id` text,
	`home_abbr` text,
	`home_location` text,
	`home_name` text,
	`home_display` text,
	`home_color` text,
	`home_logo` text,
	`home_score` integer,
	`home_winner` integer,
	`away_team_id` text,
	`away_abbr` text,
	`away_location` text,
	`away_name` text,
	`away_display` text,
	`away_color` text,
	`away_logo` text,
	`away_score` integer,
	`away_winner` integer,
	`updated_at` text,
	PRIMARY KEY(`league`, `id`)
);
--> statement-breakpoint
CREATE INDEX `idx_games_date` ON `games` (`date`);--> statement-breakpoint
CREATE INDEX `idx_games_league_date` ON `games` (`league`,`date`);--> statement-breakpoint
CREATE INDEX `idx_games_state` ON `games` (`state`);--> statement-breakpoint
CREATE INDEX `idx_games_venue` ON `games` (`venue_id`);--> statement-breakpoint
CREATE INDEX `idx_games_home_team` ON `games` (`league`,`home_team_id`);--> statement-breakpoint
CREATE TABLE `leagues` (
	`key` text PRIMARY KEY NOT NULL,
	`label` text NOT NULL,
	`sport` text NOT NULL,
	`espn_path` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `review_votes` (
	`review_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`review_id`, `user_id`),
	FOREIGN KEY (`review_id`) REFERENCES `reviews`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_review_votes_review` ON `review_votes` (`review_id`);--> statement-breakpoint
CREATE TABLE `reviews` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`target_id` text NOT NULL,
	`game_id` text,
	`user_id` text NOT NULL,
	`author` text NOT NULL,
	`rating` integer,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_reviews_target` ON `reviews` (`scope`,`target_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`token` text NOT NULL,
	`expires_at` text NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_session_token` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `idx_session_user` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `teams` (
	`league` text NOT NULL,
	`id` text NOT NULL,
	`abbr` text,
	`location` text,
	`name` text,
	`display_name` text,
	`color` text,
	`alt_color` text,
	`logo` text,
	PRIMARY KEY(`league`, `id`)
);
--> statement-breakpoint
CREATE TABLE `tip_votes` (
	`tip_id` text NOT NULL,
	`user_id` text NOT NULL,
	`vote` integer NOT NULL,
	`created_at` text NOT NULL,
	PRIMARY KEY(`tip_id`, `user_id`),
	FOREIGN KEY (`tip_id`) REFERENCES `tips`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tip_votes_tip` ON `tip_votes` (`tip_id`);--> statement-breakpoint
CREATE TABLE `tips` (
	`id` text PRIMARY KEY NOT NULL,
	`scope` text NOT NULL,
	`target_id` text NOT NULL,
	`section` text NOT NULL,
	`user_id` text NOT NULL,
	`author` text NOT NULL,
	`body` text NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_tips_target` ON `tips` (`scope`,`target_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text,
	`avatar` text,
	`email_verified` integer DEFAULT false NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	`username` text,
	`display_username` text,
	`bio` text,
	`favorites` text
);
--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_email` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `idx_users_username` ON `users` ("username" COLLATE NOCASE);--> statement-breakpoint
CREATE TABLE `user_rankings` (
	`user_id` text NOT NULL,
	`game_id` text NOT NULL,
	`league` text NOT NULL,
	`away` text NOT NULL,
	`home` text NOT NULL,
	`away_logo` text,
	`home_logo` text,
	`date` text NOT NULL,
	`venue` text NOT NULL,
	`city` text,
	`fans` real NOT NULL,
	`food` real NOT NULL,
	`unique_` real NOT NULL,
	`stadium` real NOT NULL,
	`score` real NOT NULL,
	`ts` integer NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	PRIMARY KEY(`user_id`, `game_id`),
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_user_rankings_user` ON `user_rankings` (`user_id`);--> statement-breakpoint
CREATE TABLE `venue_teams` (
	`venue_id` text NOT NULL,
	`league` text NOT NULL,
	`team_id` text NOT NULL,
	PRIMARY KEY(`venue_id`, `league`, `team_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_venue_teams_venue` ON `venue_teams` (`venue_id`);--> statement-breakpoint
CREATE TABLE `venues` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`city` text,
	`state` text,
	`zip` text,
	`surface` text,
	`indoor` integer,
	`image` text
);
--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_verification_identifier` ON `verification` (`identifier`);