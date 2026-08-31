/**
 * @file voice-refine.ts
 * @description 语音识别后文本智能润色流式 AI 能力 Pipeline
 */

import { streamText } from "ai";
import { createLogger } from "../../lib/logger.js";
import {
  buildVoiceRefineSystemPrompt,
  type VoiceRefineMode,
} from "./prompts/index.js";

export type { VoiceRefineMode };

const log = createLogger("voice-refine");

export interface StreamVoiceRefineOptions {
  apiKey: string;
  rawText: string;
  mode?: VoiceRefineMode;
  contextText?: string;
}

/**
 * 执行语音转写文本的智能润色（流式）
 */
export async function streamVoiceRefine(
  options: StreamVoiceRefineOptions
): Promise<ReturnType<typeof streamText>> {
  const { apiKey, rawText, mode = "smooth", contextText } = options;

  const { createDeepSeek } = await import("@ai-sdk/deepseek");
  const deepseek = createDeepSeek({ apiKey: apiKey.trim() });
  const modelToUse = deepseek("deepseek-v4-flash");

  const systemPrompt = buildVoiceRefineSystemPrompt({
    mode,
    contextText,
  });

  const polishStartTime = Date.now();
  log.info(`[Voice Refine Started] 开始调用 DeepSeek v4-flash 流式润色...`, {
    mode,
    rawTextLength: rawText.length,
  });

  return streamText({
    model: modelToUse,
    system: systemPrompt,
    prompt: rawText,
    onFinish: ({ text: refinedText }) => {
      const polishDurationMs = Date.now() - polishStartTime;
      log.info(
        `[Voice Refine Finished] DeepSeek v4-flash 润色完成，耗时: ${polishDurationMs}ms`,
        {
          polishDurationMs,
          refinedText,
        }
      );
    },
  });
}
