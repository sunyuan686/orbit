import { generateText, type LanguageModel, type UIMessage } from "ai";
import { extractVisibleTextFromParts } from "../../lib/ai-message-content.js";
import { createLogger } from "../../lib/logger.js";
import { buildHandoffSummaryPrompt } from "./prompts/index.js";

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
export interface HandoffSummaryResult {
  text: string | null;
  usage?: {
    inputTokens?: number;
    outputTokens?: number;
    totalTokens?: number;
  };
  llmRequest?: unknown;
  llmResponse?: unknown;
}

export async function generateHandoffSummary({
  model,
  droppedTurns,
}: GenerateHandoffSummaryOptions): Promise<HandoffSummaryResult | null> {
  if (!droppedTurns || droppedTurns.length === 0) {
    return null;
  }

  const renderedHistory = renderTurnsForSummarizer(droppedTurns);
  const prompt = buildHandoffSummaryPrompt({ renderedHistory });

  try {
    const startedAt = Date.now();
    const response = await generateText({
      model,
      prompt,
      temperature: 0.2,
      include: {
        requestBody: true,
        requestMessages: true,
        responseBody: true,
      },
    });

    const summaryText = response.text.trim();
    const step = response.steps[0];
    log.info("compaction summary generated successfully", {
      turnsCount: droppedTurns.length,
      durationMs: Date.now() - startedAt,
      summaryLength: summaryText.length,
    });

    return {
      text: summaryText,
      usage: response.usage
        ? {
            inputTokens: response.usage.inputTokens,
            outputTokens: response.usage.outputTokens,
            totalTokens: response.usage.totalTokens,
          }
        : undefined,
      llmRequest:
        step?.request?.body ??
        (step?.request?.messages ? { messages: step.request.messages } : undefined),
      llmResponse:
        step?.response?.body ??
        (step?.response?.messages
          ? { messages: step.response.messages }
          : undefined),
    };
  } catch (err) {
    log.error("compaction summary generation failed, falling back to static truncation", err);
    return null;
  }
}
