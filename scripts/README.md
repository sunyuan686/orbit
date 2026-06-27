# Scripts

维护脚本：

| 脚本 | 命令 | 用途 | 风险 |
|------|------|------|------|
| `search-status.ts` | `npm run db:search-status` | 查看本地 FTS 搜索索引状态 | 只读 |
| `migrate-to-r2.sh` | 见下方 | 把 `data/assets/` 上传到**远程** R2 | 覆盖同名对象，不删 D1 |

**不要在 CI 里跑** `migrate-to-r2.sh`。CI 只用 `wrangler d1 migrations apply`（增量改表结构，不导数据）。

`migrate-to-r2.sh` 用法（灾难恢复 / 补传图片）：

```bash
bash scripts/migrate-to-r2.sh   # 需 wrangler login；上传到远程 orbit-media
```

已归档的一次性脚本（数据导入、迁移基线）见 [`archive/`](./archive/README.md)，**勿再运行**。

约定：

- **运行时权威数据在** `data/orbit.db`（应用内增删改）。
- `content/` 为 Markdown 归档，不自动同步数据库。
- 本地数据库和上传图片放在 `data/`，不提交。
- 历史快照放在 `backups/`，不提交。
