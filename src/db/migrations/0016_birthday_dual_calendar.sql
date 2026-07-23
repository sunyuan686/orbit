ALTER TABLE `user` DROP COLUMN `birthday_calendar`;
--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `birthday_month`;
--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `birthday_day`;
--> statement-breakpoint
ALTER TABLE `user` DROP COLUMN `birthday_leap_month`;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_solar_month` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_solar_day` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_lunar_month` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_lunar_day` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_lunar_leap_month` integer DEFAULT false;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_remind_calendar` text;
