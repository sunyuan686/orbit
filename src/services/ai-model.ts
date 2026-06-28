import { createAnthropic } from "@ai-sdk/anthropic";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import {
  APP_SETTING_KEYS,
  buildAppSettings,
  resolveAiModelId,
  type AiProvider,
} from "../app-settings.js";
import { readSettingsMap } from "../db/settings-store.js";
import { decryptSettingSecret } from "../lib/secret-crypto.js";

export interface AiRuntimeEnv {
  AI?: Ai;
  BETTER_AUTH_SECRET?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  OPENAI_API_KEY?: string;
  ANTHROPIC_API_KEY?: string;
  DEEPSEEK_API_KEY?: string;
}

export interface ResolvedModel {
  model: LanguageModel;
  provider: AiProvider;
  modelId: string;
}

export class AiModelConfigError extends Error {
  constructor(
    message: string,
    readonly status: 422 | 500 = 422
  ) {
    super(message);
    this.name = "AiModelConfigError";
  }
}

async function readProviderKey(
  settingsMap: Record<string, string>,
  key: string,
  secret?: string
): Promise<string | null> {
  const encrypted = settingsMap[key]?.trim();
  if (!encrypted) return null;
  if (!secret) {
    throw new AiModelConfigError("服务端未配置加密密钥，无法读取 API Key", 500);
  }
  return decryptSettingSecret(encrypted, secret);
}

export async function resolveModel(
  db: any,
  env: AiRuntimeEnv = process.env as AiRuntimeEnv
): Promise<ResolvedModel> {
  const settingsMap = await readSettingsMap(db);
  const settings = buildAppSettings(settingsMap);
  const modelId = resolveAiModelId(settings.aiProvider, settings.aiModel);
  const secret = env.BETTER_AUTH_SECRET;

  if (settings.aiProvider === "workers-ai") {
    const workersai = env.AI
      ? createWorkersAI({ binding: env.AI })
      : createWorkersAI({
          accountId: env.CF_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID ?? "",
          apiKey: env.CF_API_TOKEN ?? process.env.CF_API_TOKEN ?? "",
        });

    if (!env.AI && !(env.CF_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID)?.trim()) {
      throw new AiModelConfigError(
        "Workers AI 未配置：请设置 CF_ACCOUNT_ID 与 CF_API_TOKEN，或使用 wrangler dev"
      );
    }

    return { model: workersai(modelId), provider: settings.aiProvider, modelId };
  }

  if (settings.aiProvider === "openai") {
    const apiKey =
      (await readProviderKey(settingsMap, APP_SETTING_KEYS.aiOpenaiKey, secret)) ??
      env.OPENAI_API_KEY ??
      process.env.OPENAI_API_KEY ??
      null;
    if (!apiKey) {
      throw new AiModelConfigError("已选择 OpenAI，但未配置 API Key");
    }
    const openai = createOpenAI({ apiKey });
    return { model: openai(modelId), provider: settings.aiProvider, modelId };
  }

  if (settings.aiProvider === "anthropic") {
    const apiKey =
      (await readProviderKey(
        settingsMap,
        APP_SETTING_KEYS.aiAnthropicKey,
        secret
      )) ??
      env.ANTHROPIC_API_KEY ??
      process.env.ANTHROPIC_API_KEY ??
      null;
    if (!apiKey) {
      throw new AiModelConfigError("已选择 Anthropic，但未配置 API Key");
    }
    const anthropic = createAnthropic({ apiKey });
    return { model: anthropic(modelId), provider: settings.aiProvider, modelId };
  }

  if (settings.aiProvider === "deepseek") {
    const apiKey =
      (await readProviderKey(
        settingsMap,
        APP_SETTING_KEYS.aiDeepseekKey,
        secret
      )) ??
      env.DEEPSEEK_API_KEY ??
      process.env.DEEPSEEK_API_KEY ??
      null;
    if (!apiKey) {
      throw new AiModelConfigError("已选择 DeepSeek，但未配置 API Key");
    }
    const deepseek = createDeepSeek({ apiKey });
    return { model: deepseek(modelId), provider: settings.aiProvider, modelId };
  }

  throw new AiModelConfigError(`未知的 AI 提供商：${settings.aiProvider}`);
}
