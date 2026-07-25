ALTER TABLE `ai_conversation` ADD `source` text DEFAULT 'web' NOT NULL;
--> statement-breakpoint
CREATE TABLE `feishu_thread_session` (
	`thread_key` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_active_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_feishu_thread_session_last_active` ON `feishu_thread_session` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_feishu_thread_session_user` ON `feishu_thread_session` (`user_id`);