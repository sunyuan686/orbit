ALTER TABLE `user` ADD `birthday_calendar` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_month` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_day` integer;
--> statement-breakpoint
ALTER TABLE `user` ADD `birthday_leap_month` integer DEFAULT false;
