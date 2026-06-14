CREATE TABLE `asset` (
	`id` text PRIMARY KEY NOT NULL,
	`entry_id` text,
	`storage_key` text NOT NULL,
	`url` text NOT NULL,
	`mime_type` text DEFAULT 'image/jpeg' NOT NULL,
	`width` integer,
	`height` integer,
	`size` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`entry_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `entry` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`author` text,
	`title` text,
	`body` text,
	`entry_date` integer,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE TABLE `memo` (
	`id` text PRIMARY KEY NOT NULL,
	`key` text NOT NULL,
	`title` text NOT NULL,
	`body` text,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `memo_key_unique` ON `memo` (`key`);--> statement-breakpoint
CREATE TABLE `settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL
);
