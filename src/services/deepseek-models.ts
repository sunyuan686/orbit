import { APP_SETTING_KEYS } from "../app-settings.js";
import { decryptSettingSecret } from "../lib/secret-crypto.js";
import type { AiRuntimeEnv } from "./ai-model.js";

export interface DeepseekModelOption {
  id: string;
  label: string;
  description: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  recommended?: boolean;
  legacy?: boolean;
}

export interface DeepseekModelsResponse {
  models: DeepseekModelOption[];
  source: "api" | "fallback";
}

interface DeepseekApiModel {
  id: string;
  object?: string;
  owned_by?: string;
}

interface DeepseekModelsApiResponse {
  object?: string;
  data?: DeepseekApiModel[];
}

interface ModelMetadata {
  description: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  recommended?: boolean;
  legacy?: boolean;
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const DEEPSEEK_MODELS_URL = "https://api.deepseek.com/models";

const MODEL_METADATA: Record<string, ModelMetadata> = {
  "deepseek-v4-flash": {
    description: "V4 主力模型，性价比高，1M 上下文，支持工具调用。",
    contextWindow: 1_000_000,
    capabilities: ["工具调用", "推理"],
    supportsToolCalling: true,
    recommended: true,
  },
  "deepseek-v4-pro": {
    description: "V4 高能力模型，1M 上下文，支持工具调用。",
    contextWindow: 1_000_000,
    capabilities: ["工具调用", "推理"],
    supportsToolCalling: true,
    recommended: true,
  },
};

/** Legacy aliases retired by DeepSeek; never shown in model pickers. */
const HIDDEN_DEEPSEEK_MODEL_IDS = new Set([
  "deepseek-chat",
  "deepseek-reasoner",
]);

export const FALLBACK_DEEPSEEK_MODELS: DeepseekModelOption[] = [
  "deepseek-v4-flash",
  "deepseek-v4-pro",
].map(toOption);

let catalogCache: { expiresAt: number; models: DeepseekModelOption[] } | null =
  null;

function toOption(modelId: string): DeepseekModelOption {
  const meta = MODEL_METADATA[modelId];
  return {
    id: modelId,
    label: modelId,
    description: meta?.description ?? "DeepSeek 模型",
    contextWindow: meta?.contextWindow,
    capabilities: meta?.capabilities ?? ["工具调用"],
    supportsToolCalling: meta?.supportsToolCalling ?? true,
    recommended: meta?.recommended,
    legacy: meta?.legacy,
  };
}

function sortModels(models: DeepseekModelOption[]): DeepseekModelOption[] {
  return [...models].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

function isVisibleDeepseekModel(modelId: string): boolean {
  return !HIDDEN_DEEPSEEK_MODEL_IDS.has(modelId);
}

function mergeApiModels(apiModels: DeepseekApiModel[]): DeepseekModelOption[] {
  const seen = new Set<string>();
  const models: DeepseekModelOption[] = [];

  for (const apiModel of apiModels) {
    const id = apiModel.id?.trim();
    if (!id || seen.has(id) || !isVisibleDeepseekModel(id)) continue;
    seen.add(id);
    models.push(toOption(id));
  }

  for (const fallback of FALLBACK_DEEPSEEK_MODELS) {
    if (!seen.has(fallback.id)) {
      models.push(fallback);
    }
  }

  return sortModels(models);
}

export async function resolveDeepseekApiKey(
  settingsMap: Record<string, string>,
  env: AiRuntimeEnv = process.env as AiRuntimeEnv
): Promise<string | null> {
  const encrypted = settingsMap[APP_SETTING_KEYS.aiDeepseekKey]?.trim();
  const secret = env.BETTER_AUTH_SECRET ?? process.env.BETTER_AUTH_SECRET;

  if (encrypted && secret) {
    return decryptSettingSecret(encrypted, secret);
  }

  const envKey = (env.DEEPSEEK_API_KEY ?? process.env.DEEPSEEK_API_KEY ?? "").trim();
  return envKey || null;
}

export async function testDeepseekConnection(apiKey: string): Promise<void> {
  const models = await fetchModelsFromApi(apiKey);
  if (!Array.isArray(models) || models.length === 0) {
    throw new Error("DeepSeek models response empty");
  }
}

async function fetchModelsFromApi(apiKey: string): Promise<DeepseekApiModel[]> {
  const response = await fetch(DEEPSEEK_MODELS_URL, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`DeepSeek models request failed (${response.status})`);
  }

  const payload = (await response.json()) as DeepseekModelsApiResponse;
  if (!Array.isArray(payload.data)) {
    throw new Error("DeepSeek models response invalid");
  }

  return payload.data;
}

export async function listDeepseekModels(
  _apiKey?: string | null
): Promise<DeepseekModelsResponse> {
  return { models: FALLBACK_DEEPSEEK_MODELS, source: "catalog" as any };
}
