# Scripts

维护脚本：

| 脚本 | npm 命令 | 用途 |
|------|----------|------|
| `search-status.ts` | `npm run db:search-status` | 查看 FTS 搜索索引状态 |
| `migrate-to-r2.sh` | `bash scripts/migrate-to-r2.sh` | 把 `data/assets/` 上传到 Cloudflare R2（生产部署用） |

约定：

- **运行时权威数据在** `data/orbit.db`（应用内增删改）。
- `content/` 为 Markdown 归档，不自动同步数据库。
- 本地数据库和上传图片放在 `data/`，不提交。
- 历史快照放在 `backups/`，不提交。
