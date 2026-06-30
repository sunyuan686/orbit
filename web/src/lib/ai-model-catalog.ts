import {
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_ENABLED_AI_MODELS,
  DEFAULT_WORKERS_AI_MODEL,
  inferAiProviderFromModelId,
  type AiCustomConnectionPublic,
  type AiProvider,
  type DeepseekModelOption,
  type WorkersAiModelOption,
} from "./api";

export interface UnifiedChatModel {
  id: string;
  label: string;
  description: string;
  provider: AiProvider;
  connectionId?: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  recommended?: boolean;
}

export function formatCustomModelRef(
  connectionId: string,
  modelId: string
): string {
  return `custom:${connectionId}:${modelId}`;
}

export function formatWorkersAiModelRef(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith("workers-ai:")) return trimmed;
  return `workers-ai:${trimmed}`;
}

export function formatDeepseekModelRef(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith("deepseek:")) return trimmed;
  if (trimmed.startsWith("custom:") || trimmed.startsWith("workers-ai:")) {
    return trimmed;
  }
  return `deepseek:${trimmed}`;
}

export function parseModelRef(raw: string): {
  kind: "custom" | "workers-ai" | "deepseek";
  connectionId?: string;
  modelId: string;
} | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("custom:")) {
    const rest = trimmed.slice("custom:".length);
    const separator = rest.indexOf(":");
    if (separator <= 0) return null;
    const connectionId = rest.slice(0, separator);
    const modelId = rest.slice(separator + 1).trim();
    if (!connectionId || !modelId) return null;
    return { kind: "custom", connectionId, modelId };
  }

  if (trimmed.startsWith("deepseek:")) {
    const modelId = trimmed.slice("deepseek:".length).trim();
    return modelId ? { kind: "deepseek", modelId } : null;
  }

  if (trimmed.startsWith("workers-ai:")) {
    const modelId = trimmed.slice("workers-ai:".length).trim();
    return modelId.startsWith("@cf/") ? { kind: "workers-ai", modelId } : null;
  }

  if (trimmed.startsWith("@cf/")) {
    return { kind: "workers-ai", modelId: trimmed };
  }

  if (trimmed.toLowerCase().includes("deepseek")) {
    return { kind: "deepseek", modelId: trimmed };
  }

  return null;
}

export function buildUnifiedChatModels(
  workersModels: WorkersAiModelOption[],
  deepseekModels: DeepseekModelOption[],
  connections: AiCustomConnectionPublic[]
): UnifiedChatModel[] {
  const unified: UnifiedChatModel[] = [];

  for (const model of workersModels) {
    if (model.task !== "Text Generation") continue;
    unified.push({
      id: formatWorkersAiModelRef(model.id),
      label: model.label,
      description: model.description,
      provider: "workers-ai",
      contextWindow: model.contextWindow,
      capabilities: model.capabilities,
      supportsToolCalling: model.supportsToolCalling,
      recommended: model.recommended,
    });
  }

  for (const model of deepseekModels) {
    unified.push({
      id: formatDeepseekModelRef(model.id),
      label: model.label,
      description: model.description,
      provider: "deepseek",
      contextWindow: model.contextWindow,
      capabilities: model.capabilities,
      supportsToolCalling: model.supportsToolCalling,
      recommended: model.recommended,
    });
  }

  for (const connection of connections) {
    for (const model of connection.models) {
      unified.push({
        id: formatCustomModelRef(connection.id, model.id),
        label: model.label?.trim() || model.id,
        description: connection.name,
        provider: "custom",
        connectionId: connection.id,
        capabilities: ["OpenAI 兼容"],
        supportsToolCalling: true,
      });
    }
  }

  return sortUnifiedModels(unified);
}

export function sortUnifiedModels(models: UnifiedChatModel[]): UnifiedChatModel[] {
  return [...models].sort((a, b) => {
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export interface ProviderModelGroup {
  id: string;
  label: string;
  provider: AiProvider | "connection";
  connectionId?: string;
  models: UnifiedChatModel[];
  enabled: boolean;
  requiresKey: boolean;
  hasApiKey: boolean;
  canToggle: boolean;
}

export function groupCatalogForSettings(
  catalog: UnifiedChatModel[],
  connections: AiCustomConnectionPublic[],
  opts: {
    hasDeepseekKey: boolean;
    enabledProviders: AiProvider[];
  }
): ProviderModelGroup[] {
  const workersModels = catalog.filter((model) => model.provider === "workers-ai");
  const deepseekModels = catalog.filter((model) => model.provider === "deepseek");
  const workersEnabled = opts.enabledProviders.includes("workers-ai");
  const deepseekEnabled = opts.enabledProviders.includes("deepseek");

  const groups: ProviderModelGroup[] = [
    {
      id: "workers-ai",
      label: "Cloudflare Workers AI",
      provider: "workers-ai",
      models: workersModels,
      enabled: workersEnabled,
      requiresKey: false,
      hasApiKey: true,
      canToggle: true,
    },
    {
      id: "deepseek",
      label: "DeepSeek",
      provider: "deepseek",
      models: deepseekModels,
      enabled: deepseekEnabled,
      requiresKey: true,
      hasApiKey: opts.hasDeepseekKey,
      canToggle: true,
    },
  ];

  for (const connection of connections) {
    groups.push({
      id: connection.id,
      label: connection.name,
      provider: "connection",
      connectionId: connection.id,
      models: catalog.filter((model) => model.connectionId === connection.id),
      enabled: connection.enabled,
      requiresKey: true,
      hasApiKey: connection.hasApiKey,
      canToggle: true,
    });
  }

  return groups;
}

export function filterChatSelectableModels(
  models: UnifiedChatModel[],
  enabledIds: string[],
  opts?: {
    hasDeepseekKey?: boolean;
    enabledProviders?: AiProvider[];
    connections?: AiCustomConnectionPublic[];
  }
): UnifiedChatModel[] {
  const enabled = new Set(enabledIds);
  const providers = opts?.enabledProviders
    ? new Set(opts.enabledProviders)
    : null;
  const connectionMap = new Map(
    (opts?.connections ?? []).map((connection) => [connection.id, connection])
  );

  return models.filter((model) => {
    if (!enabled.has(model.id)) return false;
    if (model.provider === "workers-ai") {
      return !providers || providers.has("workers-ai");
    }
    if (model.provider === "deepseek") {
      if (providers && !providers.has("deepseek")) return false;
      return Boolean(opts?.hasDeepseekKey);
    }
    if (model.provider === "custom" && model.connectionId) {
      const connection = connectionMap.get(model.connectionId);
      if (!connection || !connection.enabled || !connection.hasApiKey) {
        return false;
      }
    }
    return true;
  });
}

export function resolveModelDisplayLabel(
  modelRef: string,
  catalog: UnifiedChatModel[]
): string {
  const match = catalog.find((model) => model.id === modelRef);
  if (match) return match.label;
  const parsed = parseModelRef(modelRef);
  if (parsed?.kind === "custom") return parsed.modelId;
  if (parsed?.kind === "workers-ai") return parsed.modelId;
  if (parsed?.kind === "deepseek") return parsed.modelId;
  return modelRef;
}

export function resolveEffectiveModelRef(
  provider: AiProvider,
  rawModel: string
): string {
  const trimmed = rawModel.trim();
  const parsed = parseModelRef(trimmed);
  if (parsed?.kind === "custom") {
    return formatCustomModelRef(parsed.connectionId!, parsed.modelId);
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

export function modelRefForSettings(modelRef: string): string {
  return modelRef;
}

export function inferProvider(modelRef: string): AiProvider {
  return inferAiProviderFromModelId(modelRef);
}

export { DEFAULT_ENABLED_AI_MODELS };
