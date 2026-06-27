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
	FOREIGN KEY (`article_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "ai_conversation_context_mode_check" CHECK("ai_conversation"."context_mode" IN ('global', 'article'))
);
--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_user_updated` ON `ai_conversation` (`user_id`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_shared` ON `ai_conversation` (`shared`,`updated_at`);
--> statement-breakpoint
CREATE INDEX `idx_ai_conversation_article` ON `ai_conversation` (`article_id`);
--> statement-breakpoint
CREATE TABLE `ai_message` (
	`id` text PRIMARY KEY NOT NULL,
	`conversation_id` text NOT NULL,
	`role` text NOT NULL,
	`author` text,
	`parts` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`conversation_id`) REFERENCES `ai_conversation`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "ai_message_role_check" CHECK("ai_message"."role" IN ('user', 'assistant', 'tool'))
);
--> statement-breakpoint
CREATE INDEX `idx_ai_message_conversation` ON `ai_message` (`conversation_id`,`created_at`);
