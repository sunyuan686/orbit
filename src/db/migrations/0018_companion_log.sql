CREATE TABLE `companion_log` (
	`id` text PRIMARY KEY NOT NULL,
	`space_id` text NOT NULL,
	`recipient_user_id` text NOT NULL,
	`type` text NOT NULL,
	`target_id` text,
	`payload` text,
	`status` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CHECK(`type` IN ('memory_echo', 'milestone', 'digest', 'weekly_reflection')),
	CHECK(`status` IN ('sent', 'skipped', 'failed'))
);
--> statement-breakpoint
CREATE INDEX `idx_companion_dedup` ON `companion_log` (`space_id`,`recipient_user_id`,`target_id`,`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_companion_log_created` ON `companion_log` (`created_at`);
