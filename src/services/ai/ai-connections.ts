import { createOpenAI } from "@ai-sdk/openai";
import { decryptSettingSecret } from "../../lib/secret-crypto.js";

export interface AiConnectionModel {
  id: string;
  label?: string;
}

export interface AiCustomConnection {
  id: string;
  name: string;
  baseUrl: string;
  models: AiConnectionModel[];
  enabled: boolean;
}

export interface AiCustomConnectionPublic extends AiCustomConnection {
  hasApiKey: boolean;
}

export interface ParsedCustomModelRef {
  kind: "custom";
  connectionId: string;
  modelId: string;
}

export interface ParsedWorkersAiModelRef {
  kind: "workers-ai";
  modelId: string;
}

export interface ParsedDeepseekModelRef {
  kind: "deepseek";
  modelId: string;
}

export interface ParsedAlibabaModelRef {
  kind: "alibaba";
  modelId: string;
}

export type ParsedModelRef =
  | ParsedCustomModelRef
  | ParsedWorkersAiModelRef
  | ParsedDeepseekModelRef
  | ParsedAlibabaModelRef;

const CUSTOM_MODEL_PREFIX = "custom:";
const WORKERS_AI_MODEL_PREFIX = "workers-ai:";
const DEEPSEEK_MODEL_PREFIX = "deepseek:";
const ALIBABA_MODEL_PREFIX = "alibaba:";
const CONNECTION_KEY_PREFIX = "ai_connection_key_";
const MAX_CONNECTIONS = 16;
const MAX_MODELS_PER_CONNECTION = 64;

interface OpenAiModelsApiResponse {
  data?: Array<{ id?: string }>;
}

export function connectionKeySettingId(connectionId: string): string {
  return `${CONNECTION_KEY_PREFIX}${connectionId}`;
}

export function isConnectionKeySetting(key: string): boolean {
  return key.startsWith(CONNECTION_KEY_PREFIX);
}

export function formatCustomModelRef(
  connectionId: string,
  modelId: string
): string {
  return `${CUSTOM_MODEL_PREFIX}${connectionId}:${modelId}`;
}

export function formatWorkersAiModelRef(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith(WORKERS_AI_MODEL_PREFIX)) return trimmed;
  return `${WORKERS_AI_MODEL_PREFIX}${trimmed}`;
}

export function formatDeepseekModelRef(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith(DEEPSEEK_MODEL_PREFIX)) return trimmed;
  if (trimmed.startsWith(CUSTOM_MODEL_PREFIX)) return trimmed;
  return `${DEEPSEEK_MODEL_PREFIX}${trimmed}`;
}

export function formatAlibabaModelRef(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith(ALIBABA_MODEL_PREFIX)) return trimmed;
  if (trimmed.startsWith(CUSTOM_MODEL_PREFIX)) return trimmed;
  return `${ALIBABA_MODEL_PREFIX}${trimmed}`;
}

export function parseModelRef(raw: string): ParsedModelRef | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith(CUSTOM_MODEL_PREFIX)) {
    const rest = trimmed.slice(CUSTOM_MODEL_PREFIX.length);
    const separator = rest.indexOf(":");
    if (separator <= 0) return null;
    const connectionId = rest.slice(0, separator);
    const modelId = rest.slice(separator + 1).trim();
    if (!connectionId || !modelId) return null;
    return { kind: "custom", connectionId, modelId };
  }

  if (trimmed.startsWith(DEEPSEEK_MODEL_PREFIX)) {
    const modelId = trimmed.slice(DEEPSEEK_MODEL_PREFIX.length).trim();
    return modelId ? { kind: "deepseek", modelId } : null;
  }

  if (trimmed.startsWith(ALIBABA_MODEL_PREFIX)) {
    const modelId = trimmed.slice(ALIBABA_MODEL_PREFIX.length).trim();
    return modelId ? { kind: "alibaba", modelId } : null;
  }

  if (trimmed.startsWith(WORKERS_AI_MODEL_PREFIX)) {
    const modelId = trimmed.slice(WORKERS_AI_MODEL_PREFIX.length).trim();
    return modelId.startsWith("@cf/") ? { kind: "workers-ai", modelId } : null;
  }

  if (trimmed.startsWith("@cf/")) {
    return { kind: "workers-ai", modelId: trimmed };
  }

  if (trimmed.toLowerCase().includes("qwen")) {
    return { kind: "alibaba", modelId: trimmed };
  }

  if (trimmed.toLowerCase().includes("deepseek")) {
    return { kind: "deepseek", modelId: trimmed };
  }

  return null;
}

export function normalizeEnabledModelRef(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("@cf/")) {
    return formatWorkersAiModelRef(trimmed);
  }

  const parsed = parseModelRef(trimmed);
  if (!parsed) return null;
  if (parsed.kind === "custom") {
    return formatCustomModelRef(parsed.connectionId, parsed.modelId);
  }
  if (parsed.kind === "workers-ai") {
    return formatWorkersAiModelRef(parsed.modelId);
  }
  if (parsed.kind === "alibaba") {
    return formatAlibabaModelRef(parsed.modelId);
  }
  return formatDeepseekModelRef(parsed.modelId);
}

export function normalizeConnectionBaseUrl(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, "");
  if (!trimmed) throw new Error("Base URL 不能为空");
  const url = new URL(trimmed);
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new Error("Base URL 必须是 http 或 https");
  }
  return trimmed;
}

export function openAiCompatibleBaseUrl(baseUrl: string): string {
  const normalized = normalizeConnectionBaseUrl(baseUrl);
  if (normalized.endsWith("/v1")) return normalized;
  return `${normalized}/v1`;
}

export function parseAiConnections(raw: string | undefined): AiCustomConnection[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map(sanitizeConnection)
      .filter((connection): connection is AiCustomConnection => connection !== null)
      .slice(0, MAX_CONNECTIONS);
  } catch {
    return [];
  }
}

export function serializeAiConnections(connections: AiCustomConnection[]): string {
  return JSON.stringify(connections.slice(0, MAX_CONNECTIONS));
}

function sanitizeConnection(value: unknown): AiCustomConnection | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  const name = typeof record.name === "string" ? record.name.trim() : "";
  const baseUrl =
    typeof record.baseUrl === "string" ? record.baseUrl.trim() : "";
  const enabled = record.enabled !== false;
  if (!id || !name || !baseUrl) return null;

  let normalizedBaseUrl: string;
  try {
    normalizedBaseUrl = normalizeConnectionBaseUrl(baseUrl);
  } catch {
    return null;
  }

  const models = Array.isArray(record.models)
    ? record.models
        .map(sanitizeConnectionModel)
        .filter((model): model is AiConnectionModel => model !== null)
        .slice(0, MAX_MODELS_PER_CONNECTION)
    : [];

  return {
    id,
    name: name.slice(0, 64),
    baseUrl: normalizedBaseUrl,
    models,
    enabled,
  };
}

function sanitizeConnectionModel(value: unknown): AiConnectionModel | null {
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const id = typeof record.id === "string" ? record.id.trim() : "";
  if (!id) return null;
  const label =
    typeof record.label === "string" && record.label.trim()
      ? record.label.trim().slice(0, 128)
      : undefined;
  return { id: id.slice(0, 256), label };
}

export function validateAiConnections(
  connections: AiCustomConnection[]
): string | null {
  if (connections.length > MAX_CONNECTIONS) {
    return `最多添加 ${MAX_CONNECTIONS} 个自定义连接`;
  }
  const ids = new Set<string>();
  for (const connection of connections) {
    if (ids.has(connection.id)) return "连接 ID 重复";
    ids.add(connection.id);
    if (!connection.name.trim()) return "连接名称不能为空";
    try {
      normalizeConnectionBaseUrl(connection.baseUrl);
    } catch (err) {
      return err instanceof Error ? err.message : "Base URL 无效";
    }
    if (connection.models.length > MAX_MODELS_PER_CONNECTION) {
      return `每个连接最多 ${MAX_MODELS_PER_CONNECTION} 个模型`;
    }
    const modelIds = new Set<string>();
    for (const model of connection.models) {
      if (modelIds.has(model.id)) return `连接「${connection.name}」存在重复模型`;
      modelIds.add(model.id);
    }
  }
  return null;
}

export function findConnection(
  connections: AiCustomConnection[],
  connectionId: string
): AiCustomConnection | null {
  return connections.find((connection) => connection.id === connectionId) ?? null;
}

export async function readConnectionApiKey(
  settingsMap: Record<string, string>,
  connectionId: string,
  secret?: string
): Promise<string | null> {
  const encrypted = settingsMap[connectionKeySettingId(connectionId)]?.trim();
  if (!encrypted) return null;
  if (!secret) {
    throw new Error("服务端未配置加密密钥，无法读取 API Key");
  }
  return decryptSettingSecret(encrypted, secret);
}

export async function listOpenAiCompatibleModels(
  baseUrl: string,
  apiKey: string
): Promise<AiConnectionModel[]> {
  const url = `${openAiCompatibleBaseUrl(baseUrl)}/models`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    throw new Error(`拉取模型列表失败（${response.status}）`);
  }

  const payload = (await response.json()) as OpenAiModelsApiResponse;
  const models = (payload.data ?? [])
    .map((item) => item.id?.trim())
    .filter((id): id is string => Boolean(id));

  return [...new Set(models)].map((id) => ({ id, label: id }));
}

export async function testOpenAiCompatibleConnection(
  baseUrl: string,
  apiKey: string
): Promise<void> {
  const url = `${openAiCompatibleBaseUrl(baseUrl)}/models`;
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });
  if (!response.ok) {
    throw new Error(`连接失败（${response.status}）`);
  }
}

export function createOpenAiCompatibleModel(
  baseUrl: string,
  apiKey: string,
  modelId: string
) {
  const provider = createOpenAI({
    apiKey,
    baseURL: openAiCompatibleBaseUrl(baseUrl),
  });
  return provider.chat(modelId);
}
