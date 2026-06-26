CREATE TABLE `audit_log` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text,
	`author` text DEFAULT '' NOT NULL,
	`action` text NOT NULL,
	`resource_type` text NOT NULL,
	`resource_id` text,
	`metadata` text,
	`request_id` text,
	`created_at` integer DEFAULT (unixepoch()) NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_created` ON `audit_log` (`created_at`);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_resource` ON `audit_log` (`resource_type`,`resource_id`);
--> statement-breakpoint
CREATE INDEX `idx_audit_log_action` ON `audit_log` (`action`);
