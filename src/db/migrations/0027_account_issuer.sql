ALTER TABLE `account` ADD `issuer` text;
--> statement-breakpoint
UPDATE `account` SET `issuer` = CASE WHEN `provider_id` = 'credential' THEN 'local:credential' ELSE 'local:' || `provider_id` END WHERE `issuer` IS NULL;
