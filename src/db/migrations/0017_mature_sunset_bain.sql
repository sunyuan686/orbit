CREATE TABLE `ai_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`context_mode` text NOT NULL,
	`article_id` text,
	`user_id` text NOT NULL,
	`author` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	`last_preview` text DEFAULT '' NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`article_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_conversation_context_mode_check" CHECK("ai_conversation"."context_mode" IN ('global', 'article')),
	CONSTRAINT "ai_conversation_source_check" CHECK("ai_conversation"."source" IN ('web', 'feishu'))
);
--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_user_updated` ON `ai_conversation` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_shared` ON `ai_conversation` (`shared`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_article` ON `ai_conversation` (`article_id`);--> statement-breakpoint
CREATE TABLE `ai_message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`user_id` text,
	`author` text,
	`parts` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_message_role_check" CHECK("ai_message"."role" IN ('user', 'assistant', 'tool'))
);
--> statement-breakpoint
CREATE INDEX `idx_ai_message_conversation` ON `ai_message` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `api_token` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`token_hash` text NOT NULL,
	`token_prefix` text NOT NULL,
	`user_id` text NOT NULL,
	`author` text DEFAULT '' NOT NULL,
	`last_used_at` integer,
	`revoked_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `api_token_token_hash_unique` ON `api_token` (`token_hash`);--> statement-breakpoint
CREATE INDEX `idx_api_token_user` ON `api_token` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_api_token_revoked` ON `api_token` (`revoked_at`);--> statement-breakpoint
CREATE TABLE `asset_reference` (
	`storage_key` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	PRIMARY KEY(`storage_key`, `source_type`, `source_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_reference_source` ON `asset_reference` (`source_type`,`source_id`);--> statement-breakpoint
CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`author` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`request_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_created` ON `audit_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_resource` ON `audit_log` (`resource_type`,`resource_id`);--> statement-breakpoint
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);--> statement-breakpoint
CREATE TABLE `comment` (
	`id` text PRIMARY KEY NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`kind` text NOT NULL,
	`user_id` text,
	`author` text DEFAULT '' NOT NULL,
	`body` text NOT NULL,
	`quote` text,
	`anchor_from` integer,
	`anchor_to` integer,
	`anchor_prefix` text,
	`anchor_suffix` text,
	`parent_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "comment_target_type_check" CHECK("comment"."target_type" IN ('entry', 'memo')),
	CONSTRAINT "comment_kind_check" CHECK("comment"."kind" IN ('bottom', 'inline'))
);
--> statement-breakpoint
CREATE INDEX `idx_comment_target` ON `comment` (`target_type`,`target_id`,`kind`);--> statement-breakpoint
CREATE INDEX `idx_comment_parent` ON `comment` (`parent_id`);--> statement-breakpoint
CREATE TABLE `feishu_message_dedup` (
	`message_id` text PRIMARY KEY NOT NULL,
	`created_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_feishu_message_dedup_created` ON `feishu_message_dedup` (`created_at`);--> statement-breakpoint
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
CREATE INDEX `idx_feishu_thread_session_user` ON `feishu_thread_session` (`user_id`);--> statement-breakpoint
CREATE TABLE `milestone_unlock` (
	`id` text PRIMARY KEY NOT NULL,
	`milestone_key` text NOT NULL,
	`unlocked_at` integer NOT NULL,
	`celebrated_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `milestone_unlock_milestone_key_unique` ON `milestone_unlock` (`milestone_key`);--> statement-breakpoint
CREATE INDEX `idx_milestone_unlock_unlocked` ON `milestone_unlock` (`unlocked_at`);--> statement-breakpoint
CREATE TABLE `notification` (
	`id` text PRIMARY KEY NOT NULL,
	`recipient` text NOT NULL,
	`recipient_user_id` text,
	`type` text NOT NULL,
	`target_type` text NOT NULL,
	`target_id` text NOT NULL,
	`actor` text NOT NULL,
	`actor_user_id` text,
	`title` text NOT NULL,
	`body` text NOT NULL,
	`link` text NOT NULL,
	`payload` text,
	`read_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`actor_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_notification_recipient_read` ON `notification` (`recipient_user_id`,`read_at`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_notification_merge` ON `notification` (`recipient_user_id`,`type`,`target_id`,`read_at`);--> statement-breakpoint
CREATE TABLE `space_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`created_by`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `space_invite_token_unique` ON `space_invite` (`token`);--> statement-breakpoint
CREATE INDEX `idx_space_invite_token` ON `space_invite` (`token`);--> statement-breakpoint
ALTER TABLE `entry` ADD `modified_by_user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `entry` ADD `modified_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `memo` ADD `user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `memo` ADD `author` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `memo` ADD `modified_by_user_id` text REFERENCES user(id);--> statement-breakpoint
ALTER TABLE `memo` ADD `modified_by` text DEFAULT '' NOT NULL;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_solar_month` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_solar_day` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_lunar_month` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_lunar_day` integer;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_lunar_leap_month` integer DEFAULT false;--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_remind_calendar` text;--> statement-breakpoint
CREATE INDEX `idx_asset_storage_key` ON `asset` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_asset_entry_id` ON `asset` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_created` ON `asset` (`created_at`);