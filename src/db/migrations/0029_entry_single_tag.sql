ALTER TABLE `entry` ADD `tag` text;
--> statement-breakpoint
UPDATE `entry` SET `tag` = 'milestone' WHERE `is_milestone` = 1;
--> statement-breakpoint
UPDATE `entry` SET `tag` = 'appreciation' WHERE `moment_tag` = 'appreciation';
--> statement-breakpoint
UPDATE `entry` SET `tag` = 'message' WHERE `moment_tag` = 'message';
--> statement-breakpoint
ALTER TABLE `entry` DROP COLUMN `is_milestone`;
--> statement-breakpoint
ALTER TABLE `entry` DROP COLUMN `moment_tag`;
--> statement-breakpoint
CREATE INDEX `idx_entry_type_tag` ON `entry` (`type`, `tag`, `entry_date`);
