ALTER TABLE `user` ADD `notification_preferences` text;
--> statement-breakpoint
ALTER TABLE `user` ADD `voice_transcribe_mode` text DEFAULT 'smooth';
