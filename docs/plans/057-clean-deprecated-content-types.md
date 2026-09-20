# 全栈收敛清理废弃条目类型（留言板、时间线等）

> 创建：2026-09-11 · 
> 状态：已完成

## 目标

从第一性原理出发，彻底清理全栈代码中残留的 `timeline`（时间线）、`message`（留言板）、`diary` 等冗余且过时的条目类型，全栈正本清源对齐当前的物理事实源：**动态 (`moment`)** 与 **信件 (`letter`)**。

## 步骤

1. **记忆星图与档案收敛**：
   - 修复 `web/src/pages/Memories.tsx`：将 `TYPE_TABS` 收敛为 `全部`、`动态 (moment)`、`信箱 (letter)`，彻底移除 `message`、`timeline` 与 `diary`。
   - 更新 `src/services/companion/love-memories.ts`：`byType` 计数初始化对齐 `moment` 与 `letter`。
   - 更新 `src/services/space/activity.ts`：`ACTIVITY_ENTRY_TYPES` 收敛为 `["moment", "letter"]`。

2. **每日刮刮卡与伴侣引擎修复**：
   - 更新 `src/services/companion/scratch-card.ts`：`TYPE_LABEL_MAP` 对齐 `moment` 与 `letter`；历史打捞 `inArray` 查询加入 `moment`，移除已废弃类型；保底问答卡片链接改向动态流 `/`。
   - 更新 `src/services/companion/companion-engine.ts`：记忆回响与每周回顾统计收敛为 `moment` 与 `letter`。

3. **AI 工具与提示词对齐**：
   - 更新 `src/services/ai/ai-tools.ts`：`search_entries` 与 `write_content` 的参数 Enum 与描述收敛为 `moment` 与 `letter`。
   - 更新 `src/services/ai/ai-tool-approval.ts`、`web/src/lib/ai-write-approval.ts` 及 `chat-agent.ts`。

4. **飞书集成收敛**：
   - 更新 `src/services/feishu/feishu-inbound.ts`：指令收敛为 `/动态` 与 `/信`（对旧指令平滑映射至 `moment`），回执卡片标签对齐；更新 `feishu-settings.ts` 默认类型为 `moment`。
   - 更新 `src/services/feishu/feishu-callback.ts`：标签映射收敛。

5. **条目类型单一事实源 (SSOT) 与策略**：
   - 更新 `src/shared/specs/entry-types.ts` 与 `src/lib/entry-types.ts`：仅保留 `moment` 与 `letter`，提供旧类型平滑映射；移除 `messages` 等冗余别名。
   - 更新 `src/services/content/content-write.ts`：`ContentType` 收敛为 `"moment" | "letter"`。
   - 更新 `src/shared/policies/comment-capabilities.ts`：`CommentableContentType` 收敛为 `moment` 与 `letter`。

6. **前端外壳、旧代码清理与路由平滑**：
   - 清理 `web/src/pages/ArticleList.tsx` 中针对 `message` 与 `timeline` 的专属旧卡片组件与渲染分支。
   - 更新 `web/src/components/layout/MobileShell.tsx` 与 `DesktopShell.tsx` 路由判断；更新 `NotificationsSettingsPanel.tsx` 文案。
   - 更新 `web/src/App.tsx`：为 `/timeline`、`/message`、`/diary` 增加重定向至 `/`。
   - 清理 `web/src/index.css` 中的陈旧选择器。

## 完成标准（可验证）

- [x] `npm run typecheck` 零错误通过
- [x] `npm run web:build` 构建零错误通过
- [x] 后端测试用例 `npm test` 全部通过（49/49 pass）
- [x] 彻底消除兼容性补丁与胶水代码：
  - 移除了 `LEGACY_TYPE_MAP` 字典与别名兜底
  - 飞书指令严格对齐 `/动态`、`/信`，修复 `/today` 历史筛选与消息合并断流 Bug
  - 彻底拔除 `ArticleList.tsx` 留存的 7 个旧时代卡片组件与 `viewMode` 分支（净删除 500+ 行死代码）
  - 修复成就系统 `love-memories.ts` 统计，动态成就恢复计算
  - 清理 `comments`、`notify`、`ArticleEdit` 中遗留的 `memo` / `diary` 防御性分支
- [x] 记忆星图页面展示正确的 `全部 (325)`、`动态 (275)`、`信箱 (50)`，不再有留言板与时间线
- [x] 每日刮刮卡与历史漫游可正确打捞动态
