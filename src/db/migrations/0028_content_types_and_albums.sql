ALTER TABLE `user` ADD `about` text;
--> statement-breakpoint
ALTER TABLE `entry` ADD `is_milestone` integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE `entry` ADD `moment_tag` text;
--> statement-breakpoint
CREATE TABLE `album` (
	`id` text PRIMARY KEY NOT NULL,
	`title` text NOT NULL,
	`description` text,
	`cover_storage_key` text,
	`created_by_user_id` text REFERENCES `user`(`id`),
	`author` text DEFAULT '' NOT NULL,
	`is_default` integer DEFAULT 0 NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL,
	`deleted_at` integer
);
--> statement-breakpoint
CREATE INDEX `idx_album_created` ON `album` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_album_sort` ON `album` (`sort_order`);
--> statement-breakpoint
CREATE TABLE `album_asset` (
	`id` text PRIMARY KEY NOT NULL,
	`album_id` text NOT NULL REFERENCES `album`(`id`) ON DELETE CASCADE,
	`asset_id` text NOT NULL REFERENCES `asset`(`id`) ON DELETE CASCADE,
	`caption` text,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_album_asset_album` ON `album_asset` (`album_id`, `sort_order`);
--> statement-breakpoint
CREATE INDEX `idx_album_asset_asset` ON `album_asset` (`asset_id`);
--> statement-breakpoint
CREATE UNIQUE INDEX `uniq_album_asset` ON `album_asset` (`album_id`, `asset_id`);
--> statement-breakpoint
UPDATE `entry` SET `type` = 'moment', `is_milestone` = 1 WHERE `type` = 'timeline';
--> statement-breakpoint
UPDATE `entry` SET `type` = 'moment', `moment_tag` = 'appreciation' WHERE `type` = 'appreciation';
--> statement-breakpoint
UPDATE `entry` SET `type` = 'moment', `moment_tag` = 'message' WHERE `type` = 'message';
--> statement-breakpoint
UPDATE `entry` SET `type` = 'moment' WHERE `type` IN ('diary', 'note', 'memo');
--> statement-breakpoint
UPDATE `asset_reference` SET `source_type` = 'moment' WHERE `source_type` IN ('timeline', 'appreciation', 'diary', 'note', 'message', 'memo');
--> statement-breakpoint
INSERT OR IGNORE INTO `settings` (`key`, `value`, `updated_at`) SELECT 'space_rules', `body`, unixepoch() FROM `entry` WHERE `id` = 'mem_lks2q3p7cz' AND `body` IS NOT NULL;
--> statement-breakpoint
UPDATE `user` SET `about` = (SELECT `body` FROM `entry` WHERE `id` = 'mem_g77651pb0n') WHERE `id` = 'HwxX7NJ8Pi8ypqoCPQvaxvmfzW9e6sGK' AND `about` IS NULL;
