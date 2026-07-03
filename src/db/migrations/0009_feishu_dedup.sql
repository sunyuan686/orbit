CREATE TABLE `feishu_message_dedup` (
	`message_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_feishu_message_dedup_created` ON `feishu_message_dedup` (`created_at`);
