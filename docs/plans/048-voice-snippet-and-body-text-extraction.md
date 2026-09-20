# 语音卡片正文纯文本提取与结构化解耦施工计划

> 创建：2026-09-10 · 
> 状态：已完成

## 目标

彻底根治正文摘要（Snippet）中出现的 `0:00 💬文稿`、`🎙️ [语音]` 杂质与文稿重复问题：
1. **源头写时纯净（Clean on Write）**：修复 `src/lib/plain-text.ts` 状态机，深度配对跨过播放器控件 DOM，只提取人类讲话文稿，绝不注入伪标记；
2. **结构化解耦（Zero Glue Code）**：在 `EntrySummary` 与 API 查询中引入结构化 `hasAudio: boolean` 字段，彻底废除前端 `snippet.includes("🎙️")` 的字符串硬猜胶水；
3. **存量历史数据一次性归正**：运行 `scripts/backfill-body-text.ts`，重算历史 `body_text` 并重建 FTS 索引，读取链路上零清洗、零补丁；
4. **补充回归测试**：在 `tests/plain-text.test.ts` 验证各种复杂富文本结构下的纯文本提取正确性。

## 步骤

1. 升级 `src/lib/plain-text.ts`：
   - 改进音频卡片块扫描逻辑，通过标签深度计数器（`depth`）精确闭合外层卡片；
   - 提取纯净 `data-transcript` / 文稿，去除 `🎙️ [语音]` 字符串。
2. 升级 `src/api/articles.ts` 与 `web/src/lib/api.ts`：
   - `EntrySummary` 增加 `hasAudio?: boolean`；
   - SQL 查询直接映射 `hasAudio`。
3. 升级 `web/src/components/MomentCard.tsx`：
   - 移除 `snippet.includes("🎙️") || snippet.includes("[语音]")`，改用 `entry.hasAudio`。
4. 编写单元测试 `tests/plain-text.test.ts`。
5. 运行 `scripts/backfill-body-text.ts` 归正数据库存量 `body_text`。
6. 验证全量类型检查、自动化测试与前端生产构建。

## 完成标准（可验证）

- [x] `plain-text.ts` 正确跳过嵌套 DOM 且提取纯净文本，无 `0:00`、`文稿`、`🎙️ [语音]`
- [x] `tests/plain-text.test.ts` 全部通过
- [x] 数据库中存量录音动态的 `body_text` 恢复为纯自然语言，无杂质
- [x] 动态列表页上语音徽章正常展示，正文纯净且不重复
- [x] `npm run typecheck` 零错误通过
- [x] `npm test` 现有与新增测试全绿通过 (41/41 passing)
- [x] `npm run build --prefix web` 构建通过
