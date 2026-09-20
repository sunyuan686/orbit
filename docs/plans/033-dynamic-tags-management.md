# 动态标签独立实体与就地化管理施工计划

> 创建：2026-09-06 · 
> 状态：已完成

## 目标

为动态标签建立独立的数据库实体表 `tags`，提供标准化 CRUD API，实现前端全站单一数据源消费与就地化管理弹窗。

## 步骤

1. **Schema & Safe Migration**：
   - 在 `src/db/schema.ts` 声明 `tags` 表与相关类型。
   - 创建 `src/db/migrations/0030_tags_table.sql`，写入建表与种子数据。
   - 更新 `src/db/migrations/meta/_journal.json`。
   - 触发 `safeMigrate` 验证本地迁移与自动备份。
2. **后端 API & 单元测试**：
   - 编写 `src/api/tags.ts`，提供 GET (带 count 聚合)、POST、PUT、DELETE 接口及审计日志记录。
   - 在 `src/worker.ts` 挂载 `/api/tags`。
   - 编写 `tests/tags-api.test.ts` 自动化回归测试。
3. **前端 API、Hook 与主题配色**：
   - 在 `web/src/lib/api.ts` 添加 Tag 接口与网络请求。
   - 封装 `web/src/lib/tagColor.ts` 统一管理标签色系映射与 Badge 样式。
   - 封装 `web/src/hooks/useMomentTags.ts` 基于 React Query 统一管理标签数据缓存与突变。
4. **就地化管理组件与前端重构**：
   - 创建 `web/src/components/moment/TagManageModal.tsx`。
   - 升级 `web/src/components/ui/FilterChipDropdown.tsx` 支持底部操作项。
   - 重构 `web/src/pages/Home.tsx` 使用动态标签选项及管理入口。
   - 重构 `web/src/components/layout/QuickComposeSheet.tsx` 动态渲染标签胶囊与末尾 `+` 新增按钮。
   - 重构 `web/src/pages/ArticleEdit.tsx` 动态渲染元信息标签胶囊与 `+` 新增按钮。
   - 重构 `web/src/components/MomentCard.tsx` 动态匹配标签与颜色。
5. **构建与验证**：
   - 运行 `npm test`、`npm run typecheck`、`npm run web:build`。

## 完成标准（可验证）

- [x] `npm test` 全部通过（包含 tags API 聚合查询测试）
- [x] `npm run typecheck` 0 错误
- [x] `npm run web:build` 成功打包
- [x] 动态首页筛选下拉菜单动态呈现标签并支持点击管理标签
- [x] 快捷发布抽屉与全屏编辑器中新增标签后实时可用
