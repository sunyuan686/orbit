# 全站 UI 冗余说明文案清理与留白排版优化施工计划

> 创建：2026-09-12 · 
> 状态：已完成

## 目标

落实项目设计规范中「文案简单，减少画蛇添足的说明文案描述」以及留白克制原则：
1. **清理交互自我复述**：移除星图页等把明显交互包装成抒情说明的副文案；
2. **清理说明书式赘述**：移除在已有筛选器、表单项、操作按钮下多余复述用途的 Section 与 Modal 说明；
3. **精简空状态与客服感套话**：移除相册空状态教用户点击按钮的套话，精简 AI 欢迎语与 404 抒情安慰。

## 步骤

1. **改造 `web/src/pages/Memories.tsx`**：
   - 移除主标题下 `.orbit-memory-subtitle` 描述；
   - 移除回忆档案、相伴成就与总体记录热力 3 处 Section 的 `description`。
2. **改造 `web/src/pages/Space.tsx`**：
   - 移除头部说明书式副文案。
3. **改造 `web/src/components/moment/TagManageModal.tsx` 与 `web/src/pages/ArticleEdit.tsx`**：
   - 移除弹窗不必要的 `subtitle` 与 `description`。
4. **改造 `web/src/pages/Albums.tsx` 与 `web/src/pages/AlbumDetail.tsx`**：
   - 清理相册空状态卡片中的说明文案，保持标题与行动按钮的自洽排版。
5. **改造 `web/src/components/AiChatPanel.tsx` 与 `web/src/components/NotFoundState.tsx`**：
   - 移除 AI 欢迎语副标题，精简 404 描述为客观简练文案。
6. **验证与回归**：
   - `npm run typecheck` 零错误；
   - `npm test` 全部通过；
   - `npm --prefix web run build` 成功。

## 完成标准（可验证）

- [x] `Memories.tsx` 页面头部主标题与统计网格直接水平对齐，无多余副文案；
- [x] 空间档案、分类管理、草稿保存、相册空状态等无冗余说明文字；
- [x] `NotFoundState.tsx` 描述精简，`AiChatPanel.tsx` 欢迎语无模板套话；
- [x] `npm run typecheck` 零错误；
- [x] `npm test` 测试全部通过；
- [x] `npm --prefix web run build` 构建成功。
