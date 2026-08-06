import type { AiRuntimeEnv } from "./ai-model.js";
import { resolveAlibabaApiKey } from "./ai-model.js";
import { readSettingsMap } from "../db/settings-store.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("dashscope-voice");

export class DashScopeVoiceError extends Error {
  constructor(
    message: string,
    readonly status: number = 500
  ) {
    super(message);
    this.name = "DashScopeVoiceError";
  }
}

export async function transcribeAudioWithDashScope(
  audioBuffer: ArrayBuffer,
  fileName: string = "recording.wav",
  env: AiRuntimeEnv = process.env as AiRuntimeEnv,
  overrideApiKey?: string,
  db?: any
): Promise<{ text: string; provider: "dashscope" }> {
  let apiKey = overrideApiKey?.trim();
  if (!apiKey && db) {
    try {
      const settingsMap = await readSettingsMap(db);
      apiKey = (await resolveAlibabaApiKey(settingsMap, env)) ?? undefined;
    } catch {
      // Ignore DB read errors
    }
  }

  if (!apiKey) {
    apiKey = (await resolveAlibabaApiKey({}, env)) ?? undefined;
  }

  if (!apiKey || !apiKey.trim()) {
    throw new DashScopeVoiceError(
      "未配置 DASHSCOPE_API_KEY，请在系统设置中配置 DashScope API Key 或在环境变量中设置",
      422
    );
  }

  const startTime = Date.now();
  const base64Audio = Buffer.from(audioBuffer).toString("base64");
  const audioMimeType = fileName.endsWith(".wav") ? "audio/wav" : "audio/webm";
  const dataUri = `data:${audioMimeType};base64,${base64Audio}`;

  const configuredUrl =
    env?.DASHSCOPE_BASE_URL ||
    process.env.DASHSCOPE_BASE_URL ||
    "https://dashscope.aliyuncs.com";
  let origin = "https://dashscope.aliyuncs.com";
  try {
    const urlObj = new URL(configuredUrl);
    origin = urlObj.origin;
  } catch {
    origin = "https://dashscope.aliyuncs.com";
  }

  const endpoint = `${origin}/api/v1/services/aigc/multimodal-generation/generation`;

  // 1. 优先使用阿里云百炼 2026 官方最新规范指定模型：qwen3-asr-flash (同步调用，支持 <5分钟 音频 Data URI)
  try {
    const stepStart = Date.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: "qwen3-asr-flash",
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  audio: dataUri,
                },
              ],
            },
          ],
        },
        parameters: {
          asr_options: {
            enable_itn: false,
            language: "zh",
          },
        },
      }),
    });

    const stepDurationMs = Date.now() - stepStart;

    if (response.ok) {
      const data = (await response.json()) as any;
      // 解析官方规范结构：output.choices[0].message.content[0].text 或 output.output.sentence.text
      const choicesText = data.output?.choices?.[0]?.message?.content?.[0]?.text;
      const sentenceText = data.output?.output?.sentence?.text;
      const topOutputText = data.output?.text;
      const text = (choicesText || sentenceText || topOutputText || "").trim();

      if (text) {
        const totalDurationMs = Date.now() - startTime;
        log.info(`[DashScope qwen3-asr-flash STT] 识别成功，耗时: ${totalDurationMs}ms (HTTP: ${stepDurationMs}ms)`, {
          totalDurationMs,
          stepDurationMs,
          endpoint,
          text,
        });
        return { text, provider: "dashscope" };
      }
    } else {
      const errText = await response.text().catch(() => "");
      log.warn(`[DashScope qwen3-asr-flash Alert] (${response.status}, HTTP: ${stepDurationMs}ms): ${errText}`);
    }
  } catch (err: any) {
    log.warn("DashScope qwen3-asr-flash exception", {
      error: err?.message || String(err),
      endpoint,
    });
  }

  // 2. 备选方案：qwen-audio-3.0-asr-flash (同步 Multimodal Generation 接口)
  try {
    const stepStart = Date.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey.trim()}`,
        "Content-Type": "application/json",
      },
      signal: AbortSignal.timeout(15000),
      body: JSON.stringify({
        model: "qwen-audio-3.0-asr-flash",
        input: {
          messages: [
            {
              role: "user",
              content: [
                {
                  type: "input_audio",
                  input_audio: {
                    data: dataUri,
                  },
                },
              ],
            },
          ],
        },
        parameters: {
          format: fileName.endsWith(".wav") ? "wav" : "opus",
          sample_rate: "16000",
        },
      }),
    });

    const stepDurationMs = Date.now() - stepStart;

    if (response.ok) {
      const data = (await response.json()) as any;
      const text = (
        data.output?.choices?.[0]?.message?.content?.[0]?.text ||
        data.output?.output?.sentence?.text ||
        data.output?.text ||
        ""
      ).trim();
      if (text) {
        const totalDurationMs = Date.now() - startTime;
        log.info(`[DashScope qwen-audio-3.0-asr-flash STT] 识别成功，耗时: ${totalDurationMs}ms (HTTP: ${stepDurationMs}ms)`, {
          totalDurationMs,
          stepDurationMs,
          endpoint,
          text,
        });
        return { text, provider: "dashscope" };
      }
    }
  } catch (err: any) {
    log.warn("DashScope qwen-audio-3.0-asr-flash exception", {
      error: err?.message || String(err),
      endpoint,
    });
  }

  throw new DashScopeVoiceError(
    "阿里 DashScope 语音识别服务无响应，请检查 DASHSCOPE_API_KEY 与网络设置",
    500
  );
}
