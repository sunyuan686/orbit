# 备忘录数据表归并至 entry 计划

> 创建：2026-08-15 · 
> 状态：已完成 ✅

## 目标

从第一性原理出发，消除 `memo` 单独分表带来的历史冗余与双重查询胶水代码，将备忘录统一收敛为 `entry` 表的 `type = 'memo'` 记录，下线 `memo` 物理表及 `memo_fts` 虚拟表。

## 步骤

1. **数据库 Migration 脚本编制**：
   - 新建 `src/db/migrations/0023_merge_memo_into_entry.sql`，编写数据平移（`memo` -> `entry`）、`comment` targetType 刷洗、清理 `memo_fts` 触发器/虚拟表及删除 `memo` 表逻辑。
   - 在 `src/db/migrations/meta/_journal.json` 中注册迁移 entry。
2. **Schema 与类型定义精简**：
   - 修改 `src/db/schema.ts`，移除 `memo` 表定义，调整 `comment` 约束。
   - 确认 `src/lib/entry-types.ts` 中 `memo` 条目元数据定义（保持 `editScope: "couple"`，排除在时光流 feed 外）。
3. **后端服务与 API 胶水代码清理**：
   - `src/api/articles.ts`：移除针对 memo 的独立列表/插入/更新/删除 fallback 分支，统一走 entry 逻辑。
   - `src/api/comments.ts`：移除查 memo 的 fallback 逻辑，统一校验 entry。
   - `src/services/search.ts`：下线 `memo_fts` 搜索与索引状态探测，统一为 `entry_fts`。
   - `src/services/ai-tools.ts` / `src/services/content-write.ts` / `src/services/gallery.ts` / `src/services/asset-references.ts`：移除 memo 分支。
4. **前端适配与类型对齐**：
   - `web/src/pages/ArticleEdit.tsx` 与 `ArticleView.tsx`：评论 `targetType` 统一为 `"entry"`。
   - `scripts/search-status.ts`：清理对 `memo_fts` 的引用。
5. **本地与生产验证**：
   - 启动本地服务，自动执行迁移，验证历史 memo 数据无损平移。
   - 验证备忘录 CRUD、评论、行内边注、全文搜索与 AI 工具检索。

## 完成标准（可验证）

- [x] `npm run typecheck` 与 `npm run web:build` 编译无报错
- [x] 本地启动自动执行 migration `0023_merge_memo_into_entry.sql` 且无报错
- [x] 访问 `/memo` 列表正常，能正常新建、编辑、删除备忘录
- [x] 备忘录的底部评论与行内边注功能正常
- [x] 全文搜索（`/search?q=...`）能正常检索备忘录内容
- [x] AI 对话（`search_entries` / `list_memos`）能正常读取备忘录
