# 动态条目统一单标签架构重构

> 创建：2026-09-06 · 
> 状态：已完成

## 目标

正本清源优化数据架构：从 `entry` 表彻底移除专用的 `is_milestone`（布尔）与 `moment_tag`（文本）两个定制补丁列，收敛为通用的单标签字段 `tag`（TEXT），建立 `(type, tag, entry_date)` 索引。清理所有相关的过渡与胶水代码，保证全栈类型与接口规范干净。

## 步骤

1. 创建标准数据库迁移 `src/db/migrations/0029_entry_single_tag.sql`，无损迁移历史数据并 DROP 旧列。
2. 注册 `src/db/migrations/meta/_journal.json` 并更新 `src/db/schema.ts`。
3. 更新后端 Presenter (`src/lib/article-present.ts`) 与 API (`src/api/articles.ts`)，使用 `tag` 替代旧参数，清除兼容胶水代码。
4. 更新前端 API 客户端 (`web/src/lib/api.ts`) 与动态流组件（`Home.tsx`, `MomentCard.tsx`, `QuickComposeSheet.tsx`），改为单选微标签交互与按 `tag` 切片。
5. 运行迁移、测试与前端编译验证闭环。

## 完成标准（可验证）

- [x] 数据库完成迁移：`entry` 表包含 `tag` 列，`is_milestone` 与 `moment_tag` 已安全移除
- [x] 历史足迹数据平迁为 `tag = 'milestone'`，历史感谢数据平迁为 `tag = 'appreciation'`
- [x] 后端单元测试全部通过：`npm run test`
- [x] 后端类型检查通过：`npm run typecheck`
- [x] 前端构建成功：`npm run build --prefix web`
- [x] 首页「全部 / 📌 足迹 / 💖 感谢」切片与快速发文抽屉功能正常且无死代码
