# Scripts

脚本按用途分为几类：

- `import-md.ts`：从 `content/` 导入 Markdown 到本地 SQLite。
- `migrate.ts`：一次性旧资料迁移脚本，从根目录旧 Markdown 拆分到 `content/`，图片写入 `data/assets/`。
- `migrate-to-r2.sh`：把本地 `data/assets/` 上传到 Cloudflare R2。
- `normalize-*.py`：维护类脚本，用于修正历史 Markdown 格式。
- `verify-import.py`：校验 `backups/data-0616`、`content/` 与本地数据库导入结果。

约定：

- 可提交的 Markdown 内容放在 `content/`。
- 本地数据库和上传图片放在 `data/`，不提交。
- 历史快照放在 `backups/`，不提交。
