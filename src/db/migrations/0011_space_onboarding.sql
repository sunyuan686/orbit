CREATE TABLE `space_invite` (
	`id` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`created_by` text NOT NULL,
	`expires_at` integer NOT NULL,
	`used_at` integer,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `space_invite_token_unique` ON `space_invite` (`token`);
--> statement-breakpoint
ALTER TABLE `memo` ADD `user_id` text REFERENCES user(id);
--> statement-breakpoint
ALTER TABLE `memo` ADD `modified_by_user_id` text REFERENCES user(id);
--> statement-breakpoint
ALTER TABLE `entry` ADD `modified_by_user_id` text REFERENCES user(id);
--> statement-breakpoint
ALTER TABLE `notification` ADD `recipient_user_id` text REFERENCES user(id);
--> statement-breakpoint
ALTER TABLE `notification` ADD `actor_user_id` text REFERENCES user(id);
--> statement-breakpoint
ALTER TABLE `ai_message` ADD `user_id` text REFERENCES user(id);
--> statement-breakpoint
UPDATE `entry` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `user_id` IS NULL AND `author` IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `entry` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `user_id` IS NULL AND `author` IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `entry` SET `modified_by_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `modified_by_user_id` IS NULL AND COALESCE(NULLIF(`modified_by`, ''), `author`) IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `entry` SET `modified_by_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `modified_by_user_id` IS NULL AND COALESCE(NULLIF(`modified_by`, ''), `author`) IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `entry` SET `modified_by_user_id` = `user_id`
WHERE `modified_by_user_id` IS NULL AND `user_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `memo` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `user_id` IS NULL AND `author` IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `memo` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `user_id` IS NULL AND `author` IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `memo` SET `modified_by_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `modified_by_user_id` IS NULL AND COALESCE(NULLIF(`modified_by`, ''), `author`) IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `memo` SET `modified_by_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `modified_by_user_id` IS NULL AND COALESCE(NULLIF(`modified_by`, ''), `author`) IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `memo` SET `modified_by_user_id` = `user_id`
WHERE `modified_by_user_id` IS NULL AND `user_id` IS NOT NULL;
--> statement-breakpoint
UPDATE `comment` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `user_id` IS NULL AND `author` IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `comment` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `user_id` IS NULL AND `author` IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `notification` SET `recipient_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `recipient_user_id` IS NULL AND `recipient` IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `notification` SET `recipient_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `recipient_user_id` IS NULL AND `recipient` IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `notification` SET `actor_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `actor_user_id` IS NULL AND `actor` IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `notification` SET `actor_user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `actor_user_id` IS NULL AND `actor` IN ('User B', 'zhi');
--> statement-breakpoint
UPDATE `ai_message` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User A' LIMIT 1)
WHERE `user_id` IS NULL AND `role` = 'user' AND `author` IN ('User A', 'yuan');
--> statement-breakpoint
UPDATE `ai_message` SET `user_id` = (SELECT `id` FROM `user` WHERE `name` = 'User B' LIMIT 1)
WHERE `user_id` IS NULL AND `role` = 'user' AND `author` IN ('User B', 'zhi');
