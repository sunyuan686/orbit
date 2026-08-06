import type { AiRuntimeEnv } from "./ai-model.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("workers-ai-whisper");

export class WorkersAiWhisperError extends Error {
  constructor(
    message: string,
    readonly status: 400 | 422 | 500 = 500
  ) {
    super(message);
    this.name = "WorkersAiWhisperError";
  }
}

export async function transcribeAudioWithWorkersAi(
  audioBuffer: ArrayBuffer,
  env: AiRuntimeEnv = process.env as AiRuntimeEnv
): Promise<string> {
  // 1. 如果是在 Cloudflare Worker 算力节点环境（有 env.AI binding）
  if (env.AI) {
    try {
      const audioArray = Array.from(new Uint8Array(audioBuffer));
      const res = (await env.AI.run("@cf/openai/whisper", {
        audio: audioArray,
      })) as { result?: { text?: string }; text?: string };

      const text = res.result?.text ?? res.text ?? "";
      if (!text) {
        log.warn("Workers AI binding (Whisper) returned empty transcription");
      }
      return text.trim();
    } catch (err: any) {
      log.error("Workers AI binding Whisper error", { error: err?.message || String(err) });
      throw new WorkersAiWhisperError(
        `Cloudflare Workers AI 语音转写失败: ${err.message || String(err)}`,
        500
      );
    }
  }

  // 2. 如果在 Node.js 本地开发模式下（通过 CF_ACCOUNT_ID 与 CF_API_TOKEN 调用 Cloudflare REST API）
  const accountId = env.CF_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID ?? "";
  const apiToken = env.CF_API_TOKEN ?? process.env.CF_API_TOKEN ?? "";

  if (!accountId.trim() || !apiToken.trim()) {
    throw new WorkersAiWhisperError(
      "Workers AI 语音功能未配置：请设置 CF_ACCOUNT_ID 与 CF_API_TOKEN",
      422
    );
  }

  try {
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/@cf/openai/whisper`;
    
    const fetchStart = Date.now();
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiToken}`,
        "Content-Type": "application/octet-stream",
      },
      body: audioBuffer,
    });
    const fetchDurationMs = Date.now() - fetchStart;
    log.info(`[Whisper REST API Network] Cloudflare Workers AI HTTP fetch took ${fetchDurationMs}ms (size: ${audioBuffer.byteLength} bytes)`);

    if (!response.ok) {
      const errText = await response.text();
      log.error("Cloudflare REST API Whisper failed", { status: response.status, body: errText });
      throw new WorkersAiWhisperError(
        `Cloudflare Workers AI API 返回错误 (${response.status}): ${errText}`,
        500
      );
    }

    const data = (await response.json()) as {
      result?: { text?: string };
      success?: boolean;
      errors?: any[];
    };

    if (!data.success && data.errors && data.errors.length > 0) {
      throw new WorkersAiWhisperError(
        `Workers AI 转写失败: ${data.errors[0]?.message || "未知错误"}`,
        500
      );
    }

    const resultText = data.result?.text ?? "";
    return resultText.trim();
  } catch (err: any) {
    if (err instanceof WorkersAiWhisperError) throw err;
    log.error("Transcribe request exception", { error: err?.message || String(err) });
    throw new WorkersAiWhisperError(
      `语音转写请求异常: ${err.message || String(err)}`,
      500
    );
  }
}
