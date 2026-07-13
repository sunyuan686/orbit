CREATE TABLE `milestone_unlock` (
	`id` text PRIMARY KEY NOT NULL,
	`milestone_key` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	`celebrated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestone_unlock_milestone_key_unique` ON `milestone_unlock` (`milestone_key`);
--> statement-breakpoint
CREATE INDEX `idx_milestone_unlock_unlocked` ON `milestone_unlock` (`unlocked_at`);
