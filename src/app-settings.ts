import {
  formatAlibabaModelRef,
  formatDeepseekModelRef,
  formatWorkersAiModelRef,
  parseAiConnections,
  parseModelRef,
  serializeAiConnections,
  type AiCustomConnection,
  type AiCustomConnectionPublic,
} from "./services/ai/ai-connections.js";
import {
  BUILTIN_MODEL_SPECS,
  parseModelSpecs,
  type ModelSpecMap,
} from "./services/ai/ai-model-specs.js";

export const APP_SETTING_KEYS = {
  aiProvider: "ai_provider",
  aiModel: "ai_model",
  aiEnabledModels: "ai_enabled_models",
  aiEnabledProviders: "ai_enabled_providers",
  aiConnections: "ai_connections",
  aiModelSpecs: "ai_model_specs",
  aiDeepseekKey: "ai_deepseek_key",
  aiAlibabaKey: "ai_alibaba_key",
  aiBotName: "ai_bot_name",
  aiBotPersona: "ai_bot_persona",
} as const;

export const VOICE_TRANSCRIBE_MODES = ["smooth", "raw", "bullets", "formal"] as const;
export type VoiceTranscribeMode = (typeof VOICE_TRANSCRIBE_MODES)[number];

export const AI_PROVIDERS = ["workers-ai", "deepseek", "alibaba", "custom"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";
export const DEFAULT_ALIBABA_MODEL = "qwen3.7-plus";

export const DEFAULT_AI_BOT_NAME = "小辛星";
export const DEFAULT_AI_BOT_PERSONA =
  "你的性格温暖、真诚、细腻且富有亲和力。你的任务是陪空间内的成员聊天、帮他们回忆温馨时刻、解答日常疑问或提供生活建议。";

/** Default models visible in chat when none are configured. */
export const DEFAULT_ENABLED_AI_MODELS: readonly string[] = [
  formatWorkersAiModelRef("@cf/zai-org/glm-4.7-flash"),
  formatWorkersAiModelRef("@cf/meta/llama-3.3-70b-instruct-fp8-fast"),
  formatWorkersAiModelRef("@cf/openai/gpt-oss-20b"),
  formatDeepseekModelRef("deepseek-v4-flash"),
  formatDeepseekModelRef("deepseek-v4-pro"),
  formatAlibabaModelRef("qwen3.8-max"),
  formatAlibabaModelRef("qwen3.7-plus"),
  formatAlibabaModelRef("qwen3.5-plus"),
];

/** Built-in providers available in chat when none are configured. */
export const DEFAULT_ENABLED_AI_PROVIDERS: readonly AiProvider[] = [
  "workers-ai",
  "deepseek",
  "alibaba",
];

import {
  BUILTIN_PROVIDER_CATALOG,
  type BuiltinProviderCatalog,
} from "./services/ai/ai-model-catalog-builtin.js";

export interface AppSettings {
  aiProvider: AiProvider;
  aiModel: string;
  aiEnabledModels: string[];
  aiEnabledProviders: AiProvider[];
  aiConnections: AiCustomConnectionPublic[];
  /** 用户维护的模型规格覆盖（按 provider 分组），空对象 = 全部走内置默认 */
  aiModelSpecs: ModelSpecMap;
  /** 内置模型默认规格（只读，随设置响应下发，前端不再维护副本） */
  aiBuiltinModelSpecs: ModelSpecMap;
  /** 按 Provider 分组的内置模型目录（只读） */
  aiBuiltinCatalog: BuiltinProviderCatalog;
  hasDeepseekKey: boolean;
  hasAlibabaKey: boolean;
  aiBotName: string;
  aiBotPersona: string;
}

const DEFAULT_AI_PROVIDER: AiProvider = "workers-ai";

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export function isBuiltinAiProvider(
  provider: AiProvider
): provider is "workers-ai" | "deepseek" | "alibaba" {
  return provider === "workers-ai" || provider === "deepseek" || provider === "alibaba";
}

/** Infer provider from a canonical model ref. */
export function inferAiProviderFromModelId(modelId: string): AiProvider {
  const parsed = parseModelRef(modelId);
  if (parsed?.kind === "custom") return "custom";
  if (parsed?.kind === "workers-ai") return "workers-ai";
  if (parsed?.kind === "alibaba") return "alibaba";
  return "deepseek";
}

export function parseAiEnabledModels(raw: string | undefined): string[] {
  if (!raw?.trim()) return [...DEFAULT_ENABLED_AI_MODELS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_ENABLED_AI_MODELS];
    const ids = parsed
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(Boolean)
      .map((id) => normalizeLegacyModelRef(id))
      .filter((id): id is string => Boolean(id));
    return ids.length > 0 ? ids : [...DEFAULT_ENABLED_AI_MODELS];
  } catch {
    return [...DEFAULT_ENABLED_AI_MODELS];
  }
}

function normalizeLegacyModelRef(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parsed = parseModelRef(trimmed);
  if (!parsed) return null;
  if (parsed.kind === "custom") {
    return `custom:${parsed.connectionId}:${parsed.modelId}`;
  }
  if (parsed.kind === "workers-ai") {
    return formatWorkersAiModelRef(parsed.modelId);
  }
  if (parsed.kind === "alibaba") {
    return formatAlibabaModelRef(parsed.modelId);
  }
  return formatDeepseekModelRef(parsed.modelId);
}

export function serializeAiEnabledModels(ids: string[]): string {
  return JSON.stringify(ids);
}

export function parseAiEnabledProviders(raw: string | undefined): AiProvider[] {
  if (!raw?.trim()) return [...DEFAULT_ENABLED_AI_PROVIDERS];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [...DEFAULT_ENABLED_AI_PROVIDERS];
    const ids = parsed
      .filter((id): id is string => typeof id === "string")
      .map((id) => id.trim())
      .filter(
        (id): id is "workers-ai" | "deepseek" | "alibaba" =>
          id === "workers-ai" || id === "deepseek" || id === "alibaba"
      );
    return ids.length > 0 ? ids : [...DEFAULT_ENABLED_AI_PROVIDERS];
  } catch {
    return [...DEFAULT_ENABLED_AI_PROVIDERS];
  }
}

export function serializeAiEnabledProviders(ids: AiProvider[]): string {
  return JSON.stringify(ids.filter(isBuiltinAiProvider));
}

/** Resolve the model ref actually used for inference / display. */
export function resolveAiModelRef(
  provider: AiProvider,
  rawModel: string
): string {
  const trimmed = rawModel.trim();
  const parsed = parseModelRef(trimmed);
  if (parsed?.kind === "custom") {
    return `custom:${parsed.connectionId}:${parsed.modelId}`;
  }
  if (parsed?.kind === "workers-ai") {
    return formatWorkersAiModelRef(parsed.modelId);
  }
  if (parsed?.kind === "deepseek") {
    return formatDeepseekModelRef(parsed.modelId);
  }
  if (parsed?.kind === "alibaba") {
    return formatAlibabaModelRef(parsed.modelId);
  }
  if (provider === "custom" && trimmed) return trimmed;
  if (provider === "alibaba") {
    return formatAlibabaModelRef(DEFAULT_ALIBABA_MODEL);
  }
  if (provider === "deepseek") {
    return formatDeepseekModelRef(DEFAULT_DEEPSEEK_MODEL);
  }
  return formatWorkersAiModelRef(DEFAULT_WORKERS_AI_MODEL);
}

export function buildAppSettings(
  settingsMap: Record<string, string>,
  env?: { DEEPSEEK_API_KEY?: string; ALIBABA_API_KEY?: string; DASHSCOPE_API_KEY?: string }
): AppSettings {
  const rawProvider = settingsMap[APP_SETTING_KEYS.aiProvider]?.trim();
  let aiProvider =
    rawProvider && isAiProvider(rawProvider) ? rawProvider : DEFAULT_AI_PROVIDER;
  if (!isAiProvider(aiProvider)) {
    aiProvider = DEFAULT_AI_PROVIDER;
  }

  const aiModel = settingsMap[APP_SETTING_KEYS.aiModel]?.trim() ?? "";
  const aiEnabledModels = parseAiEnabledModels(
    settingsMap[APP_SETTING_KEYS.aiEnabledModels]
  );
  const aiEnabledProviders = parseAiEnabledProviders(
    settingsMap[APP_SETTING_KEYS.aiEnabledProviders]
  );
  const connections = parseAiConnections(
    settingsMap[APP_SETTING_KEYS.aiConnections]
  ).map((connection) => ({
    ...connection,
    hasApiKey: Boolean(
      settingsMap[`ai_connection_key_${connection.id}`]?.trim()
    ),
  }));

  const aiModelSpecs = parseModelSpecs(settingsMap[APP_SETTING_KEYS.aiModelSpecs]);

  const aiBotName =
    settingsMap[APP_SETTING_KEYS.aiBotName]?.trim() || DEFAULT_AI_BOT_NAME;
  const aiBotPersona =
    settingsMap[APP_SETTING_KEYS.aiBotPersona]?.trim() || DEFAULT_AI_BOT_PERSONA;

  const hasDeepseekKey = Boolean(
    settingsMap[APP_SETTING_KEYS.aiDeepseekKey]?.trim() ||
      env?.DEEPSEEK_API_KEY?.trim() ||
      process.env.DEEPSEEK_API_KEY?.trim()
  );

  const hasAlibabaKey = Boolean(
    settingsMap[APP_SETTING_KEYS.aiAlibabaKey]?.trim() ||
      settingsMap["ai_key_dashscope"]?.trim() ||
      env?.ALIBABA_API_KEY?.trim() ||
      env?.DASHSCOPE_API_KEY?.trim() ||
      process.env.ALIBABA_API_KEY?.trim() ||
      process.env.DASHSCOPE_API_KEY?.trim()
  );

  return {
    aiProvider,
    aiModel,
    aiEnabledModels,
    aiEnabledProviders,
    aiConnections: connections,
    aiModelSpecs,
    // 只读副本，防止调用方误改共享常量
    aiBuiltinModelSpecs: structuredClone(BUILTIN_MODEL_SPECS),
    aiBuiltinCatalog: structuredClone(BUILTIN_PROVIDER_CATALOG),
    hasDeepseekKey,
    hasAlibabaKey,
    aiBotName,
    aiBotPersona,
  };
}

export {
  parseAiConnections,
  serializeAiConnections,
  type AiCustomConnection,
  type AiCustomConnectionPublic,
};
