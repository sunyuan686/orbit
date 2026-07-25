import { generateText, type LanguageModel, type UIMessage } from "ai";
import { extractVisibleTextFromParts } from "../lib/ai-message-content.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("ai-compaction");

/**
 * Renders dropped conversation turns into a clean text representation for the summarizer model.
 */
function renderTurnsForSummarizer(turns: UIMessage[][]): string {
  const blocks: string[] = [];

  turns.forEach((turn, turnIdx) => {
    const turnLines: string[] = [`--- 历史对话轮次 #${turnIdx + 1} ---`];
    for (const msg of turn) {
      const text = extractVisibleTextFromParts(msg.parts).trim();
      const roleLabel = msg.role === "user" ? "用户" : "AI 助手";

      // Also check if there are tool invocations to summarize
      const toolNames: string[] = [];
      if (Array.isArray(msg.parts)) {
        for (const part of msg.parts as any[]) {
          if (part?.type === "tool-invocation" && part.toolInvocation?.toolName) {
            toolNames.push(part.toolInvocation.toolName);
          }
        }
      }

      let line = `[${roleLabel}]: ${text || "（系统交互）"}`;
      if (toolNames.length > 0) {
        line += ` (使用了工具: ${toolNames.join(", ")})`;
      }
      turnLines.push(line);
    }
    blocks.push(turnLines.join("\n"));
  });

  return blocks.join("\n\n");
}

export interface GenerateHandoffSummaryOptions {
  model: LanguageModel;
  droppedTurns: UIMessage[][];
}

/**
 * Generates a 4-dimensional structured Handoff Summary of dropped history turns using the chat LLM.
 */
export async function generateHandoffSummary({
  model,
  droppedTurns,
}: GenerateHandoffSummaryOptions): Promise<string | null> {
  if (!droppedTurns || droppedTurns.length === 0) {
    return null;
  }

  const renderedHistory = renderTurnsForSummarizer(droppedTurns);

  const prompt = `你是一个专业的对话上下文交接（Handoff）总结专家。
请分析以下被截断丢弃的前期历史对话轮次，并生成一份高度精炼的结构化交接摘要。

必须严格遵循以下 4 个维度进行整理（使用 Markdown 格式，保持语言简明扼要）：

1. **用户核心目标 (User Goals)**: 用户在前期提出的主要诉求或任务。
2. **已确认的事实与成果 (Key Discoveries & Accomplishments)**: 对话中查明的重要事实、检索到的空间回忆/文章或完成的操作。
3. **关键决策与偏好 (Decisions & Preferences)**: 用户或助手做出的重要决定或偏好说明。
4. **悬而未决的问题 (Pending Issues & Next Steps)**: 尚未解决的疑点或需要后续跟进的事项。

待总结的历史对话如下：
${renderedHistory}

请直接输出 4 维结构化摘要内容，无需任何开场白或解释。`;

  try {
    const startedAt = Date.now();
    const response = await generateText({
      model,
      prompt,
      // Use moderate temperature for concise factual summary
      temperature: 0.2,
    });

    const summaryText = response.text.trim();
    log.info("compaction summary generated successfully", {
      turnsCount: droppedTurns.length,
      durationMs: Date.now() - startedAt,
      summaryLength: summaryText.length,
    });

    return summaryText;
  } catch (err) {
    log.error("compaction summary generation failed, falling back to static truncation", err);
    return null;
  }
}
