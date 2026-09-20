CREATE TABLE `tags` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`color` text DEFAULT 'amber' NOT NULL,
	`sort_order` integer DEFAULT 0 NOT NULL,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	`updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_tags_sort` ON `tags` (`sort_order`, `created_at`);
--> statement-breakpoint
INSERT OR IGNORE INTO `tags` (`id`, `name`, `color`, `sort_order`) VALUES
  ('milestone', '足迹', 'amber', 1),
  ('appreciation', '感谢', 'rose', 2),
  ('message', '留言', 'sky', 3);
