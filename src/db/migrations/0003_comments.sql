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
  `parent_id` text,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL,
  `deleted_at` integer,
  FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
  FOREIGN KEY (`parent_id`) REFERENCES `comment`(`id`) ON UPDATE no action ON DELETE no action,
  CONSTRAINT `comment_target_type_check` CHECK(`target_type` IN ('entry', 'memo')),
  CONSTRAINT `comment_kind_check` CHECK(`kind` IN ('bottom', 'inline'))
);
--> statement-breakpoint
CREATE INDEX `idx_comment_target` ON `comment` (`target_type`, `target_id`, `kind`);
--> statement-breakpoint
CREATE INDEX `idx_comment_parent` ON `comment` (`parent_id`);
