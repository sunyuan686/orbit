PRAGMA foreign_keys=OFF;--> statement-breakpoint
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
	FOREIGN KEY (`parent_id`) REFERENCES `entry`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "entry_type_check" CHECK("__new_entry"."type" IN ('diary', 'timeline', 'message', 'letter', 'note', 'appreciation')),
	CONSTRAINT "entry_status_check" CHECK("__new_entry"."status" IN ('draft', 'published'))
);
--> statement-breakpoint
INSERT INTO `__new_entry`("id", "type", "user_id", "author", "modified_by_user_id", "modified_by", "title", "body", "body_text", "entry_date", "parent_id", "status", "created_at", "updated_at", "deleted_at") SELECT "id", "type", "user_id", "author", "modified_by_user_id", "modified_by", "title", "body", "body_text", "entry_date", "parent_id", "status", "created_at", "updated_at", "deleted_at" FROM `entry`;--> statement-breakpoint
DROP TABLE `entry`;--> statement-breakpoint
ALTER TABLE `__new_entry` RENAME TO `entry`;--> statement-breakpoint
PRAGMA foreign_keys=ON;--> statement-breakpoint
CREATE INDEX `idx_entry_type_date` ON `entry` (`type`,`entry_date`);--> statement-breakpoint
CREATE INDEX `idx_entry_parent` ON `entry` (`parent_id`);--> statement-breakpoint
CREATE INDEX `idx_entry_status_user` ON `entry` (`status`,`user_id`);