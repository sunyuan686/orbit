CREATE INDEX `idx_asset_storage_key` ON `asset` (`storage_key`);
--> statement-breakpoint
CREATE INDEX `idx_asset_entry_id` ON `asset` (`entry_id`);
--> statement-breakpoint
CREATE INDEX `idx_asset_created` ON `asset` (`created_at`);
--> statement-breakpoint
CREATE TABLE `asset_reference` (
	`storage_key` text NOT NULL,
	`source_type` text NOT NULL,
	`source_id` text NOT NULL,
	PRIMARY KEY(`storage_key`, `source_type`, `source_id`)
);
--> statement-breakpoint
CREATE INDEX `idx_asset_reference_source` ON `asset_reference` (`source_type`, `source_id`);
