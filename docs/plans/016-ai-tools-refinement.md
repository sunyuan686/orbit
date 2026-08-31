# AI 工具元数据集中化与 Web Search 抽离优化

> 创建：2026-08-30 · 
> 状态：已完成

## 目标

消除 AI 工具展示名称在业务端的私有硬编码，并将 Web 搜索引擎（Tavily/Brave）底层请求与降级逻辑从 `ai-tools.ts` 中剥离至独立的 Provider 服务。

## 步骤

1. 创建 `src/services/ai/web-search-provider.ts`，封装 Tavily / Brave 请求与 fallback。
2. 在 `src/services/ai/ai-tools.ts` 中定义 `AI_TOOL_METADATA` 与 `formatToolDisplayName`，并将 `web_search` 委托给 search provider。
3. 在 `src/services/feishu/feishu-ai-chat.ts` 中移除私有 `TOOL_DISPLAY_NAMES`，改用统一的 `formatToolDisplayName`。
4. 运行 `npm run typecheck` 与 `npm run web:build` 验证。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 通过
- [x] 飞书端与全局工具展示逻辑统一由 `ai-tools.ts` 驱动
