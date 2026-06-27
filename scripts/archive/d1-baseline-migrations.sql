-- 一次性基线：远程 D1 已手动跑过迁移时，写入 d1_migrations 避免 CI 重复执行。
-- 用法：npx wrangler d1 execute orbit-db --remote --file=scripts/d1-baseline-migrations.sql
-- 仅在首次启用 wrangler migrations apply 且数据库已有表结构时执行一次。

CREATE TABLE IF NOT EXISTS d1_migrations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE,
  applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL
);

INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0000_lethal_harrier.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0001_memo_author.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0002_fts_setup.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0003_comments.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0004_comment_anchor_context.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0005_modified_by.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0006_audit_log.sql');
INSERT OR IGNORE INTO d1_migrations (name) VALUES ('0007_ai_chat.sql');
