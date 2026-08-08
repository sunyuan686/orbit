import {
  DEFAULT_ALIBABA_MODEL,
  DEFAULT_DEEPSEEK_MODEL,
  DEFAULT_ENABLED_AI_MODELS,
  DEFAULT_WORKERS_AI_MODEL,
  inferAiProviderFromModelId,
  type AiCustomConnectionPublic,
  type AiProvider,
  type BuiltinProviderCatalog,
} from "./api";
import { resolveSpecKey, type ModelSpec } from "./ai-model-specs";

export interface UnifiedChatModel {
  id: string;
  label: string;
  description: string;
  provider: AiProvider;
  connectionId?: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  supportsVision?: boolean;
  supportsFileInput?: boolean;
  supportsImageOutput?: boolean;
  supportsVideoOutput?: boolean;
  supportsWebSearch?: boolean;
  recommended?: boolean;
  /** 是否为非内置的自定义添加模型 */
  isCustom?: boolean;
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
  if (trimmed.startsWith("custom:") || trimmed.startsWith("workers-ai:") || trimmed.startsWith("alibaba:")) {
    return trimmed;
  }
  return `deepseek:${trimmed}`;
}

export function formatAlibabaModelRef(modelId: string): string {
  const trimmed = modelId.trim();
  if (trimmed.startsWith("alibaba:")) return trimmed;
  if (trimmed.startsWith("custom:") || trimmed.startsWith("workers-ai:") || trimmed.startsWith("deepseek:")) {
    return trimmed;
  }
  return `alibaba:${trimmed}`;
}

export function parseModelRef(raw: string): {
  kind: "custom" | "workers-ai" | "deepseek" | "alibaba";
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

  if (trimmed.startsWith("alibaba:")) {
    const modelId = trimmed.slice("alibaba:".length).trim();
    return modelId ? { kind: "alibaba", modelId } : null;
  }

  if (trimmed.startsWith("workers-ai:")) {
    const modelId = trimmed.slice("workers-ai:".length).trim();
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

export function buildUnifiedChatModels(
  builtinCatalog?: BuiltinProviderCatalog,
  connections?: AiCustomConnectionPublic[],
  userSpecs?: Record<string, Record<string, Partial<ModelSpec>>>
): UnifiedChatModel[] {
  const unified: UnifiedChatModel[] = [];
  const seenIds = new Set<string>();

  // 1. 处理来自服务端的 Provider 分组 Builtin Catalog
  if (builtinCatalog) {
    for (const [provider, models] of Object.entries(builtinCatalog)) {
      if (!Array.isArray(models)) continue;
      for (const model of models) {
        let ref = model.id;
        if (provider === "workers-ai") ref = formatWorkersAiModelRef(model.id);
        else if (provider === "deepseek") ref = formatDeepseekModelRef(model.id);
        else if (provider === "alibaba") ref = formatAlibabaModelRef(model.id);

        if (!seenIds.has(ref)) {
          seenIds.add(ref);
          unified.push({
            id: ref,
            label: model.label,
            description: model.description,
            provider: provider as AiProvider,
            contextWindow: model.contextWindow,
            capabilities: model.capabilities,
            supportsToolCalling: model.supportsToolCalling,
            supportsVision: model.supportsVision,
            recommended: model.recommended,
            isCustom: false,
          });
        }
      }
    }
  }

  // 2. 自定义连接 (Custom Connections)
  if (connections) {
    for (const connection of connections) {
      for (const model of connection.models) {
        const ref = formatCustomModelRef(connection.id, model.id);
        if (!seenIds.has(ref)) {
          seenIds.add(ref);
          unified.push({
            id: ref,
            label: model.label?.trim() || model.id,
            description: connection.name,
            provider: "custom",
            connectionId: connection.id,
            capabilities: ["OpenAI 兼容"],
            supportsToolCalling: true,
            isCustom: true,
          });
        }
      }
    }
  }

  // 3. 用户在 Spec 中添加的额外自定义模型
  if (userSpecs) {
    for (const [provider, group] of Object.entries(userSpecs)) {
      if (!group) continue;
      for (const [key, spec] of Object.entries(group)) {
        let ref = key;
        if (provider === "workers-ai") ref = formatWorkersAiModelRef(key);
        else if (provider === "deepseek") ref = formatDeepseekModelRef(key);
        else if (provider === "alibaba") ref = formatAlibabaModelRef(key);
        else if (provider === "custom" && key.includes(":")) {
          const sep = key.indexOf(":");
          ref = formatCustomModelRef(key.slice(0, sep), key.slice(sep + 1));
        }
        if (!seenIds.has(ref)) {
          seenIds.add(ref);
          unified.push({
            id: ref,
            label: spec.name?.trim() || key,
            description: `${provider} 自定义配置`,
            provider: (provider === "connection" ? "custom" : provider) as AiProvider,
            contextWindow: spec.contextWindow || 128000,
            capabilities: [spec.reasoning ? "深度思考" : "通用对话", "自定义"],
            supportsToolCalling: spec.supportsToolCalling !== undefined ? spec.supportsToolCalling : true,
            supportsVision: spec.supportsVision ?? false,
            supportsFileInput: spec.supportsFileInput !== undefined ? spec.supportsFileInput : true,
            supportsImageOutput: spec.supportsImageOutput ?? false,
            supportsVideoOutput: spec.supportsVideoOutput ?? false,
            supportsWebSearch: spec.supportsWebSearch ?? false,
            isCustom: true,
          });
        }
      }
    }

    // 应用用户 spec 覆盖的 capabilities (Tool Calling, Vision, File, Image Gen, Video Gen, Web Search)
    for (const model of unified) {
      const resolved = resolveSpecKey(model.id);
      if (!resolved) continue;
      const userOverride = userSpecs[resolved.provider]?.[resolved.key];
      if (userOverride) {
        if (typeof userOverride.supportsToolCalling === "boolean") {
          model.supportsToolCalling = userOverride.supportsToolCalling;
        }
        if (typeof userOverride.supportsVision === "boolean") {
          model.supportsVision = userOverride.supportsVision;
        }
        if (typeof userOverride.supportsFileInput === "boolean") {
          model.supportsFileInput = userOverride.supportsFileInput;
        }
        if (typeof userOverride.supportsImageOutput === "boolean") {
          model.supportsImageOutput = userOverride.supportsImageOutput;
        }
        if (typeof userOverride.supportsVideoOutput === "boolean") {
          model.supportsVideoOutput = userOverride.supportsVideoOutput;
        }
        if (typeof userOverride.supportsWebSearch === "boolean") {
          model.supportsWebSearch = userOverride.supportsWebSearch;
        }
      }
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
    hasAlibabaKey?: boolean;
    enabledProviders: AiProvider[];
  }
): ProviderModelGroup[] {
  const workersModels = catalog.filter((model) => model.provider === "workers-ai");
  const deepseekModels = catalog.filter((model) => model.provider === "deepseek");
  const alibabaModels = catalog.filter((model) => model.provider === "alibaba");

  const workersEnabled = opts.enabledProviders.includes("workers-ai");
  const deepseekEnabled = opts.enabledProviders.includes("deepseek");
  const alibabaEnabled = opts.enabledProviders.includes("alibaba");

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
    {
      id: "alibaba",
      label: "阿里百炼 (通义千问)",
      provider: "alibaba",
      models: alibabaModels,
      enabled: alibabaEnabled,
      requiresKey: true,
      hasApiKey: Boolean(opts.hasAlibabaKey),
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
    hasAlibabaKey?: boolean;
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
    if (model.provider === "alibaba") {
      if (providers && !providers.has("alibaba")) return false;
      return Boolean(opts?.hasAlibabaKey);
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
  if (parsed?.kind === "alibaba") return parsed.modelId;
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

export function modelRefForSettings(modelRef: string): string {
  return modelRef;
}

export function inferProvider(modelRef: string): AiProvider {
  return inferAiProviderFromModelId(modelRef);
}

export { DEFAULT_ENABLED_AI_MODELS };
