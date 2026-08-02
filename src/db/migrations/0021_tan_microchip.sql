CREATE TABLE `__temp_asset` AS SELECT * FROM `asset`;--> statement-breakpoint
DROP TABLE `asset`;--> statement-breakpoint
CREATE TABLE `__temp_feishu_thread_session` AS SELECT * FROM `feishu_thread_session`;--> statement-breakpoint
DROP TABLE `feishu_thread_session`;--> statement-breakpoint
CREATE TABLE `__temp_ai_message` AS SELECT * FROM `ai_message`;--> statement-breakpoint
DROP TABLE `ai_message`;--> statement-breakpoint
CREATE TABLE `__temp_ai_conversation` AS SELECT * FROM `ai_conversation`;--> statement-breakpoint
DROP TABLE `ai_conversation`;--> statement-breakpoint
CREATE TABLE `__new_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`author` text DEFAULT '' NOT NULL,
	`modified_by_user_id` text,
	`modified_by` text DEFAULT '' NOT NULL,
	`title` text,
	`body` text,
	`body_text` text,
	`entry_date` integer,
	`parent_id` text,
	`status` text DEFAULT 'published' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`modified_by_user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_status_check" CHECK("__new_entry"."status" IN ('draft', 'published'))
);--> statement-breakpoint
INSERT INTO `__new_entry`("id", "type", "user_id", "author", "modified_by_user_id", "modified_by", "title", "body", "body_text", "entry_date", "parent_id", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "type", "user_id", "author", "modified_by_user_id", "modified_by", "title", "body", "body_text", "entry_date", "parent_id", "status", "created_at", "updated_at", "deleted_at" FROM `entry`;--> statement-breakpoint
DROP TABLE `entry`;--> statement-breakpoint
ALTER TABLE `__new_entry` RENAME TO `entry`;--> statement-breakpoint
CREATE INDEX `idx_entry_type_date` ON `entry` (`type`,`entry_date`);--> statement-breakpoint
CREATE INDEX `idx_entry_parent` ON `entry` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_entry_status_user` ON `entry` (`status`,`user_id`);--> statement-breakpoint
CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text,
	`storage_key` text NOT NULL,
	`mime_type` text DEFAULT 'image/jpeg' NOT NULL,
	`width` integer,
	`height` integer,
	`size` integer,
	`position` text DEFAULT 'a0' NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	`blurhash` text,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `asset` SELECT * FROM `__temp_asset`;--> statement-breakpoint
DROP TABLE `__temp_asset`;--> statement-breakpoint
CREATE INDEX `idx_asset_storage_key` ON `asset` (`storage_key`);--> statement-breakpoint
CREATE INDEX `idx_asset_entry_id` ON `asset` (`entry_id`);--> statement-breakpoint
CREATE INDEX `idx_asset_created` ON `asset` (`created_at`);--> statement-breakpoint
CREATE TABLE `ai_conversation` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`context_mode` text NOT NULL,
	`article_id` text,
	`user_id` text NOT NULL,
	`author` text NOT NULL,
	`shared` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`deleted_at` integer,
	`last_preview` text DEFAULT '' NOT NULL,
	`source` text DEFAULT 'web' NOT NULL,
	FOREIGN KEY (`article_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_conversation_context_mode_check" CHECK("ai_conversation"."context_mode" IN ('global', 'article'))
);--> statement-breakpoint
INSERT INTO `ai_conversation` SELECT * FROM `__temp_ai_conversation`;--> statement-breakpoint
DROP TABLE `__temp_ai_conversation`;--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_user_updated` ON `ai_conversation` (`user_id`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_shared` ON `ai_conversation` (`shared`,`updated_at`);--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_article` ON `ai_conversation` (`article_id`);--> statement-breakpoint
CREATE TABLE `ai_message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`author` text,
	`parts` text NOT NULL,
	`created_at` integer NOT NULL,
	`user_id` text,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_message_role_check" CHECK("ai_message"."role" IN ('user', 'assistant', 'tool'))
);--> statement-breakpoint
INSERT INTO `ai_message` SELECT * FROM `__temp_ai_message`;--> statement-breakpoint
DROP TABLE `__temp_ai_message`;--> statement-breakpoint
CREATE INDEX `idx_ai_message_conversation` ON `ai_message` (`conversation_id`,`created_at`);--> statement-breakpoint
CREATE TABLE `feishu_thread_session` (
	`thread_key` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`user_id` text NOT NULL,
	`last_active_at` integer NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);--> statement-breakpoint
INSERT INTO `feishu_thread_session` SELECT * FROM `__temp_feishu_thread_session`;--> statement-breakpoint
DROP TABLE `__temp_feishu_thread_session`;--> statement-breakpoint
CREATE INDEX `idx_feishu_thread_session_last_active` ON `feishu_thread_session` (`last_active_at`);--> statement-breakpoint
CREATE INDEX `idx_feishu_thread_session_user` ON `feishu_thread_session` (`user_id`);