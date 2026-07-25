import {
  formatDeepseekModelRef,
  formatWorkersAiModelRef,
  parseAiConnections,
  parseModelRef,
  serializeAiConnections,
  type AiCustomConnection,
  type AiCustomConnectionPublic,
} from "./services/ai-connections.js";

export const APP_SETTING_KEYS = {
  accentPreset: "accent_preset",
  aiProvider: "ai_provider",
  aiModel: "ai_model",
  aiEnabledModels: "ai_enabled_models",
  aiEnabledProviders: "ai_enabled_providers",
  aiConnections: "ai_connections",
  aiDeepseekKey: "ai_deepseek_key",
  aiBotName: "ai_bot_name",
  aiBotPersona: "ai_bot_persona",
} as const;

export const ACCENT_PRESETS = ["stone", "rose", "sage", "dusk"] as const;
export type AccentPreset = (typeof ACCENT_PRESETS)[number];

export const AI_PROVIDERS = ["workers-ai", "deepseek", "custom"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

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
];

/** Built-in providers available in chat when none are configured. */
export const DEFAULT_ENABLED_AI_PROVIDERS: readonly AiProvider[] = [
  "workers-ai",
  "deepseek",
];

export interface AppSettings {
  accentPreset: AccentPreset;
  aiProvider: AiProvider;
  aiModel: string;
  aiEnabledModels: string[];
  aiEnabledProviders: AiProvider[];
  aiConnections: AiCustomConnectionPublic[];
  hasDeepseekKey: boolean;
  aiBotName: string;
  aiBotPersona: string;
}

const DEFAULT_ACCENT_PRESET: AccentPreset = "stone";
const DEFAULT_AI_PROVIDER: AiProvider = "workers-ai";

export function isAccentPreset(value: string): value is AccentPreset {
  return (ACCENT_PRESETS as readonly string[]).includes(value);
}

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export function isBuiltinAiProvider(
  provider: AiProvider
): provider is "workers-ai" | "deepseek" {
  return provider === "workers-ai" || provider === "deepseek";
}

/** Infer provider from a canonical model ref. */
export function inferAiProviderFromModelId(modelId: string): AiProvider {
  const parsed = parseModelRef(modelId);
  if (parsed?.kind === "custom") return "custom";
  if (parsed?.kind === "workers-ai") return "workers-ai";
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
        (id): id is "workers-ai" | "deepseek" =>
          id === "workers-ai" || id === "deepseek"
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
  if (provider === "custom" && trimmed) return trimmed;
  if (provider === "deepseek") {
    return formatDeepseekModelRef(DEFAULT_DEEPSEEK_MODEL);
  }
  return formatWorkersAiModelRef(DEFAULT_WORKERS_AI_MODEL);
}

export function buildAppSettings(
  settingsMap: Record<string, string>
): AppSettings {
  const rawAccent = settingsMap[APP_SETTING_KEYS.accentPreset]?.trim();
  const accentPreset =
    rawAccent && isAccentPreset(rawAccent) ? rawAccent : DEFAULT_ACCENT_PRESET;

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

  const aiBotName =
    settingsMap[APP_SETTING_KEYS.aiBotName]?.trim() || DEFAULT_AI_BOT_NAME;
  const aiBotPersona =
    settingsMap[APP_SETTING_KEYS.aiBotPersona]?.trim() || DEFAULT_AI_BOT_PERSONA;

  return {
    accentPreset,
    aiProvider,
    aiModel,
    aiEnabledModels,
    aiEnabledProviders,
    aiConnections: connections,
    hasDeepseekKey: Boolean(settingsMap[APP_SETTING_KEYS.aiDeepseekKey]?.trim()),
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
