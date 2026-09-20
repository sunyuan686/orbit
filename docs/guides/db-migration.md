# 数据库 Schema 变更与安全迁移规范

修改 `src/db/schema.ts` 的表结构或执行数据洗水迁移时，**严禁写业务层 `try...catch` 兜底补丁**，必须遵循标准安全迁移流程。

---

## 一、本地开发安全流程（自动前置快照）

1. **自动前置快照机制 (`safeMigrate`)**：
   本地服务启动 (`npm run server` / `npm run dev`) 或脚本启动时，`src/db/safe-migrate.ts` 会自动比对 `_journal.json` 与已应用迁移。若检测到未应用的迁移，**会自动先对 SQLite 数据库执行 WAL 刷盘并热备份至 `data/backups/orbit_pre_migration_{tag}_{timestamp}.db`**，然后再执行 Drizzle 迁移。
2. **标准迁移三步法**：
   - **步骤 1：新增 SQL 迁移脚本**：在 `src/db/migrations/` 创建顺序编号文件（如 `0030_xxx.sql`），多条 SQL 语句间使用 `--> statement-breakpoint` 隔离。
   - **步骤 2：注册 Journal**：在 `src/db/migrations/meta/_journal.json` 的 `entries` 数组中挂载新 idx 记录。
   - **步骤 3：自动增量应用**：启动服务即可自动触发 `safeMigrate()`，安全对齐本地数据库。

---

## 二、生产与远程 Cloudflare D1 发布规范（强制前置 Export）

严禁直接裸跑 `wrangler d1 migrations apply`！必须使用内置安全机制的命令：

1. **线上安全迁移发布**：
   ```bash
   npm run db:migrate:remote
   ```
   该脚本会**先强制执行 `wrangler d1 export` 备份当前生产库全部 SQL 数据至 `data/backups/d1_pre_deploy_{timestamp}.sql`**，确认备份成功落盘后，才会执行 `wrangler d1 migrations apply`。若备份失败，会立即中止迁移以保护生产环境。
2. **独立线上备份**：
   ```bash
   npm run db:backup:remote
   ```

---

## 三、常用运维与回滚命令

| 命令 | 用途 | 说明 |
| :--- | :--- | :--- |
| `npm run db:backup` | 手动备份本地库 | 生成 `data/backups/orbit_manual_{timestamp}.db` |
| `npm run db:backup:remote` | 导出线上生产 D1 库 | 导出全量 SQL 至 `data/backups/d1_remote_{timestamp}.sql` |
| `npm run db:restore` | 查看或还原备份 | 无参数查看可用备份；加路径即可一键无损还原（自动预留撤销防险底） |
| `npm run db:migrate:remote` | 线上安全发布迁移 | 强制先导出备份，再应用 D1 迁移 |
