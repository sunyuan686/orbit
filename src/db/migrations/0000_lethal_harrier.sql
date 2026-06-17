CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
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
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`author` text DEFAULT '' NOT NULL,
	`title` text,
	`body` text,
	`body_text` text,
	`entry_date` integer,
	`parent_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`parent_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_type_check" CHECK("entry"."type" IN ('diary', 'timeline', 'message', 'letter'))
);
--> statement-breakpoint
CREATE INDEX `idx_entry_type_date` ON `entry` (`type`,`entry_date`);--> statement-breakpoint
CREATE INDEX `idx_entry_parent` ON `entry` (`parent_id`);--> statement-breakpoint
CREATE TABLE `memo` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memo_key_unique` ON `memo` (`key`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer,
	`updated_at` integer
);
