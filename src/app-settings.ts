export const APP_SETTING_KEYS = {
  accentPreset: "accent_preset",
  aiProvider: "ai_provider",
  aiModel: "ai_model",
  aiOpenaiKey: "ai_openai_key",
  aiAnthropicKey: "ai_anthropic_key",
  aiDeepseekKey: "ai_deepseek_key",
} as const;

export const ACCENT_PRESETS = ["stone", "rose", "sage", "dusk"] as const;
export type AccentPreset = (typeof ACCENT_PRESETS)[number];

export const AI_PROVIDERS = [
  "workers-ai",
  "openai",
  "anthropic",
  "deepseek",
] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_AI_MODELS: Record<AiProvider, string> = {
  "workers-ai": "@cf/zai-org/glm-4.7-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-sonnet-4-20250514",
  deepseek: "deepseek-chat",
};

export interface AppSettings {
  accentPreset: AccentPreset;
  aiProvider: AiProvider;
  aiModel: string;
  hasOpenaiKey: boolean;
  hasAnthropicKey: boolean;
  hasDeepseekKey: boolean;
}

const DEFAULT_ACCENT_PRESET: AccentPreset = "stone";
const DEFAULT_AI_PROVIDER: AiProvider = "workers-ai";

export function isAccentPreset(value: string): value is AccentPreset {
  return (ACCENT_PRESETS as readonly string[]).includes(value);
}

export function isAiProvider(value: string): value is AiProvider {
  return (AI_PROVIDERS as readonly string[]).includes(value);
}

export function buildAppSettings(
  settingsMap: Record<string, string>
): AppSettings {
  const rawAccent = settingsMap[APP_SETTING_KEYS.accentPreset]?.trim();
  const accentPreset =
    rawAccent && isAccentPreset(rawAccent) ? rawAccent : DEFAULT_ACCENT_PRESET;

  const rawProvider = settingsMap[APP_SETTING_KEYS.aiProvider]?.trim();
  const aiProvider =
    rawProvider && isAiProvider(rawProvider) ? rawProvider : DEFAULT_AI_PROVIDER;

  const aiModel = settingsMap[APP_SETTING_KEYS.aiModel]?.trim() ?? "";

  return {
    accentPreset,
    aiProvider,
    aiModel,
    hasOpenaiKey: Boolean(settingsMap[APP_SETTING_KEYS.aiOpenaiKey]?.trim()),
    hasAnthropicKey: Boolean(
      settingsMap[APP_SETTING_KEYS.aiAnthropicKey]?.trim()
    ),
    hasDeepseekKey: Boolean(settingsMap[APP_SETTING_KEYS.aiDeepseekKey]?.trim()),
  };
}
