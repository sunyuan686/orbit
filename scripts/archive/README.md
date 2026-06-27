# 已归档的一次性脚本

这里的脚本**已完成历史使命**，不要在日常部署或 CI 中运行。

| 文件 | 用途 | 为何归档 |
|------|------|----------|
| `d1-baseline-migrations.sql` | 2026-06 首次启用 `migrations apply` 前写入 `d1_migrations` 基线 | 已执行；若在空库上误跑会导致 CI 跳过真实建表 |
| `migrate-sqlite-to-d1.ts` | 本地 `data/orbit.db` → 远程 D1 一次性数据导入 | 已执行；重复跑可能污染生产数据 |

## 灾难恢复（极少使用）

仅在远程 D1 被清空、需要从本地 `data/orbit.db` 重建时：

```bash
npx tsx scripts/archive/migrate-sqlite-to-d1.ts --confirm
bash scripts/migrate-to-r2.sh
```

脚本会检测远程是否已有数据，有则拒绝执行。
