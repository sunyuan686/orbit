# 数据库自动化备份与迁移安全工作流优化

> 创建：2026-09-06 · 
> 状态：已完成

## 目标

彻底消除“未备份即执行迁移”的安全隐患，建立符合业界最佳实践的本地与线上自动化数据库备份与迁移安全机制：
1. **代码级防呆拦截**：封装 `safeMigrate`，在执行任何 Drizzle 迁移前自动探测是否有新变更，有则在就地修改前自动对 SQLite 进行 WAL 刷盘与物理快照备份，保留最近 10 次历史记录。
2. **标准化 CLI 运维命令**：提供本地快照（`db:backup`）、线上 D1 导出（`db:backup:remote`）、本地回滚（`db:restore`）以及带强制前置备份的线上发布脚本（`db:migrate:remote`）。
3. **规范文档固化**：更新 `docs/guides/db-migration.md` 与 `AGENTS.md`，硬化迁移前后闭环标准。

## 步骤

1. 创建 `src/db/safe-migrate.ts`：实现待迁移检测、热快照生成与轮转清理机制。
2. 创建运维脚本：`scripts/db-backup.ts`、`scripts/db-backup-remote.ts`、`scripts/db-restore.ts`、`scripts/db-migrate-remote.ts`。
3. 更新 `package.json` 添加对应 npm scripts。
4. 将 `src/server/index.ts` 与 `scripts/search-status.ts` 中的裸 `migrate()` 调用升级为 `safeMigrate()`。
5. 更新 `docs/guides/db-migration.md` 与 `AGENTS.md` 固化流程标准。
6. 测试备份、还原与安全迁移逻辑。

## 完成标准（可验证）

- [x] `safeMigrate()` 能准确识别待迁移项并自动在 `data/backups/` 生成时间戳备份文件
- [x] `npm run db:backup` 手动执行成功生成快照
- [x] `npm run typecheck` 与 `npm run test` 保持 100% 通过
- [x] 流程规范文档已同步更新
