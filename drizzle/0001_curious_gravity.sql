ALTER TABLE `user_rankings` ADD `venue_id` text;--> statement-breakpoint
CREATE INDEX `idx_user_rankings_venue_id` ON `user_rankings` (`venue_id`);--> statement-breakpoint
CREATE INDEX `idx_user_rankings_venue` ON `user_rankings` (`venue`);