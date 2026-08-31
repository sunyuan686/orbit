# AI 提示词体系与能力架构重构

> 创建：2026-08-30 · 
> 状态：已完成

## 目标

建立统一的 `src/services/ai/prompts/` 提示词中枢（采用 Mustache 占位符 `{{var}}` + 结构化 XML 边界 + 强类型 Compiler），并下沉内聚 AI 算力调用能力，彻底消除 API 路由与业务代码中的散落 Prompt 与 AI 胶水代码。

## 步骤

1. 创建 `src/services/ai/prompts/` 核心模块：
   - `base.ts`：基础 XML 标签与 Mustache 占位符编译渲染器。
   - `chat-agent.ts`：主空间对话助手提示词模板与编译函数。
   - `voice-refine.ts`：语音识别润色 3 模式提示词与编译函数。
   - `compaction.ts`：对话交接 4 维总结提示词与编译函数。
   - `feishu.ts`：飞书渠道专用 Suffix、陪伴卡片引言与月度回顾提示词。
   - `index.ts`：统一导出出口。
2. 封装 `src/services/ai/voice-refine.ts` 语音流式润色独立 Service 能力。
3. 重构现有业务调用点：
   - `src/services/ai/ai-prompt.ts`
   - `src/services/ai/ai-compaction.ts`
   - `src/api/ai.ts`（移除硬编码 Prompt，接入 `voice-refine.ts`）
   - `src/services/feishu/feishu-ai-chat.ts`
   - `src/services/feishu/feishu-companion-card.ts`
   - `src/services/feishu/feishu-commands.ts`
4. 验证与回归测试（typecheck + build）。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过，无类型报错
- [x] `npm run web:build` 前端构建通过
- [x] 源码中除 `prompts/` 模块外，无任何自然语言 System Prompt 硬编码
- [x] 提示词变量注入 100% 采用 `{{var}}` + 强类型 Compiler 模式
