-- 草稿箱：为 entry 表添加 status 字段
-- 现有记录默认视为 published
ALTER TABLE `entry` ADD `status` text NOT NULL DEFAULT 'published';

-- 可选：为快速查询草稿创建索引（D1/SQLite 不支持条件索引，走普通复合索引）
CREATE INDEX IF NOT EXISTS `idx_entry_status_user` ON `entry` (`status`, `user_id`);
