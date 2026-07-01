CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`actor` text NOT NULL,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text NOT NULL,
	`payload` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_notification_recipient_read` ON `notification` (`recipient`, `read_at`, `created_at` DESC);
--> statement-breakpoint
CREATE INDEX `idx_notification_merge` ON `notification` (`recipient`, `type`, `target_id`, `read_at`);
