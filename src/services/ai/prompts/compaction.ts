/**
 * @file compaction.ts
 * @description 长对话上下文压缩与交接（Handoff）总结 Prompt 模板与编译装配
 */

import { renderPrompt } from "./base.js";

export const HANDOFF_SUMMARY_PROMPT_TEMPLATE = `
你是一个专业的对话上下文交接（Handoff）总结专家。
请分析以下被截断丢弃的前期历史对话轮次，并生成一份高度精炼的结构化交接摘要。

必须严格遵循以下 4 个维度进行整理（使用 Markdown 格式，保持语言简明扼要）：

1. **用户核心目标 (User Goals)**: 用户在前期提出的主要诉求或任务。
2. **已确认的事实与成果 (Key Discoveries & Accomplishments)**: 对话中查明的重要事实、检索到的空间回忆/文章或完成的操作。
3. **关键决策与偏好 (Decisions & Preferences)**: 用户或助手做出的重要决定或偏好说明。
4. **悬而未决的问题 (Pending Issues & Next Steps)**: 尚未解决的疑点或需要后续跟进的事项。

待总结的历史对话如下：
{{rendered_history}}

请直接输出 4 维结构化摘要内容，无需任何开场白或解释。
`.trim();

export interface HandoffSummaryPromptOptions {
  renderedHistory: string;
}

/**
 * 编译对话上下文压缩交接总结 Prompt
 */
export function buildHandoffSummaryPrompt(
  options: HandoffSummaryPromptOptions
): string {
  return renderPrompt(HANDOFF_SUMMARY_PROMPT_TEMPLATE, {
    rendered_history: options.renderedHistory.trim(),
  });
}
