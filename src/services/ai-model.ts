import { createDeepSeek } from "@ai-sdk/deepseek";
import type { LanguageModel } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import {
  APP_SETTING_KEYS,
  buildAppSettings,
  DEFAULT_ALIBABA_MODEL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_WORKERS_AI_MODEL,
  resolveAiModelRef,
  type AiProvider,
} from "../app-settings.js";
import { readSettingsMap } from "../db/settings-store.js";
import { decryptSettingSecret } from "../lib/secret-crypto.js";
import {
  createOpenAiCompatibleModel,
  findConnection,
  formatAlibabaModelRef,
  formatDeepseekModelRef,
  formatWorkersAiModelRef,
  parseModelRef,
  readConnectionApiKey,
} from "./ai-connections.js";
import { wrapReasoningLanguageModel } from "./ai-model-reasoning-wrapper.js";

export interface AiRuntimeEnv {
  BETTER_AUTH_SECRET?: string;
  DEEPSEEK_API_KEY?: string;
  ALIBABA_API_KEY?: string;
  DASHSCOPE_API_KEY?: string;
  DASHSCOPE_BASE_URL?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  TAVILY_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
  LANGFUSE_ENV?: string;
  LANGFUSE_PROJECT_ID?: string;
  AI?: Ai;
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

export async function readProviderKey(
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

export async function resolveAlibabaApiKey(
  settingsMap: Record<string, string>,
  env: AiRuntimeEnv = process.env as AiRuntimeEnv
): Promise<string | null> {
  const secret = env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;
  const keyFromDb =
    (await readProviderKey(settingsMap, APP_SETTING_KEYS.aiAlibabaKey, secret)) ??
    (await readProviderKey(settingsMap, "ai_key_dashscope", secret));

  if (keyFromDb?.trim()) {
    return keyFromDb.trim();
  }

  const envKey = (
    env.ALIBABA_API_KEY ??
    env.DASHSCOPE_API_KEY ??
    process.env.ALIBABA_API_KEY ??
    process.env.DASHSCOPE_API_KEY ??
    ""
  ).trim();

  return envKey || null;
}

export async function resolveModel(
  db: any,
  env: AiRuntimeEnv = process.env as AiRuntimeEnv
): Promise<ResolvedModel> {
  const settingsMap = await readSettingsMap(db);
  const settings = buildAppSettings(settingsMap, env);
  const modelRef = resolveAiModelRef(settings.aiProvider, settings.aiModel);
  const parsed = parseModelRef(modelRef);
  const secret = env.BETTER_AUTH_SECRET;

  if (parsed?.kind === "custom") {
    const connection = findConnection(settings.aiConnections, parsed.connectionId);
    if (!connection || !connection.enabled) {
      throw new AiModelConfigError("所选模型对应的连接不存在或已关闭");
    }

    const apiKey = await readConnectionApiKey(
      settingsMap,
      parsed.connectionId,
      secret
    );
    if (!apiKey) {
      throw new AiModelConfigError(
        `连接「${connection.name}」未配置 API Key`
      );
    }

    const rawModel = createOpenAiCompatibleModel(
      connection.baseUrl,
      apiKey,
      parsed.modelId
    );
    return {
      model: wrapReasoningLanguageModel(rawModel, parsed.modelId, "custom"),
      provider: "custom",
      modelId: modelRef,
    };
  }

  if (parsed?.kind === "workers-ai") {
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

    const rawModel = workersai(parsed.modelId, {
      max_tokens: 4096,
      chat_template_kwargs: {
        enable_thinking: true,
      },
    });
    return {
      model: wrapReasoningLanguageModel(rawModel, parsed.modelId, "workers-ai"),
      provider: "workers-ai",
      modelId: formatWorkersAiModelRef(parsed.modelId),
    };
  }

  if (parsed?.kind === "alibaba") {
    const alibabaModelId = parsed.modelId || DEFAULT_ALIBABA_MODEL;
    const apiKey = await resolveAlibabaApiKey(settingsMap, env);
    if (!apiKey) {
      throw new AiModelConfigError("已选择 阿里云百炼 (通义千问)，但未配置 API Key");
    }
    const { createAlibaba } = await import("@ai-sdk/alibaba");
    const alibaba = createAlibaba({
      apiKey,
      baseURL:
        env.DASHSCOPE_BASE_URL ||
        process.env.DASHSCOPE_BASE_URL ||
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
    });
    const rawModel = alibaba(alibabaModelId);
    return {
      model: wrapReasoningLanguageModel(rawModel, alibabaModelId, "alibaba"),
      provider: "alibaba",
      modelId: formatAlibabaModelRef(alibabaModelId),
    };
  }

  const deepseekModelId =
    parsed?.kind === "deepseek" ? parsed.modelId : DEFAULT_DEEPSEEK_MODEL;
  const apiKey =
    (await readProviderKey(settingsMap, APP_SETTING_KEYS.aiDeepseekKey, secret)) ??
    env.DEEPSEEK_API_KEY ??
    process.env.DEEPSEEK_API_KEY ??
    null;
  if (!apiKey) {
    throw new AiModelConfigError("已选择 DeepSeek，但未配置 API Key");
  }
  const deepseek = createDeepSeek({ apiKey });
  const rawModel = deepseek(deepseekModelId);
  return {
    model: wrapReasoningLanguageModel(rawModel, deepseekModelId, "deepseek"),
    provider: "deepseek",
    modelId: formatDeepseekModelRef(deepseekModelId),
  };
}
