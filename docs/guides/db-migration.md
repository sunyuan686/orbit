# 数据库 Schema 变更规范

修改 `src/db/schema.ts` 的表结构时，**严禁写业务层 `try...catch` 兜底补丁**，必须遵循标准 Drizzle Migration 流程：

1. **新增 SQL 迁移脚本**：在 `src/db/migrations/` 创建顺序编号文件（如 `0022_xxx.sql`），多条 SQL 语句间用 `--> statement-breakpoint` 隔离。
2. **注册 Journal**：在 `src/db/migrations/meta/_journal.json` 的 `entries` 数组中挂载新 idx 记录。
3. **自动增量应用**：服务启动时系统将通过 `src/server/index.ts` 中的 `migrate()` 自动对齐物理数据库。
