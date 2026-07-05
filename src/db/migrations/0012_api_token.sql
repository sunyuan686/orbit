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
CREATE UNIQUE INDEX `api_token_token_hash_unique` ON `api_token` (`token_hash`);
--> statement-breakpoint
CREATE INDEX `idx_api_token_user` ON `api_token` (`user_id`);
--> statement-breakpoint
CREATE INDEX `idx_api_token_revoked` ON `api_token` (`revoked_at`);
