# AGENTS

## 核心工程原则

- **第一性原理与最佳实践**：代码保持简洁，从第一性原理出发。分析与解决问题必须使用最佳实践，**不打补丁、不掩盖症状、不偷懒**。

## 文档说明：


| 文档                           | 用途            |
| ---------------------------- | ------------- |
| [README.md](README.md)       | 项目入口、定位、启动    |
| [ROADMAP.md](ROADMAP.md)     | 功能进度          |
| [DESIGN.md](DESIGN.md)       | 视觉 token / 组件 |
| [CHANGELOG.md](CHANGELOG.md) | 版本发布记录（自动生成）  |
| [AGENTS.md](AGENTS.md)       | Agent 协作入口    |


`docs/`：按需查阅，不在此逐文件列出。


| 位置              | 放什么       | 命名                             |
| --------------- | --------- | ------------------------------ |
| `docs/` 顶层      | 平台 / 工程文档 | 大写：`ARCHITECTURE.md`           |
| `docs/specs/`   | 产品能力设计稿   | 小写 + `-`：`space-onboarding.md` |
| `docs/archive/` | 历史参考      | 小写 + `-`：`alignment-plan.md`   |


约束：产品能力 → `specs/`；平台/工程 → `docs/` 顶层；已过时 → `archive/`。词间用 `-`，不用 `_`。

---

## 数据库 Schema 变更规范

当修改 `src/db/schema.ts` 的表结构时，**严禁写业务层 `try...catch` 兜底补丁**，必须遵循标准 Drizzle Migration 流程：

1. **新增 SQL 迁移脚本**：在 `src/db/migrations/` 创建顺序编号文件（如 `0022_xxx.sql`），多条 SQL 语句间用 `--> statement-breakpoint` 隔离。
2. **注册 Journal**：在 `src/db/migrations/meta/_journal.json` 的 `entries` 数组中挂载新 idx 记录。
3. **自动增量应用**：服务启动时系统将通过 `src/server/index.ts` 中的 `migrate()` 自动对齐物理数据库。