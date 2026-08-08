/**
 * 前端模型规格模块：与服务端 src/services/ai-model-specs.ts 同构。
 * 内置默认由服务端随设置响应下发（AppSettings.aiBuiltinModelSpecs），
 * 本模块只提供类型、字段级合并与 spec key 解析。
 */

export type ReasoningLevel = "none" | "low" | "medium" | "high";

export const REASONING_LEVELS: readonly ReasoningLevel[] = [
  "none",
  "low",
  "medium",
  "high",
];

export interface ModelSpec {
  name: string;
  contextWindow: number;
  reasoning: boolean;
  defaultReasoning?: ReasoningLevel;
  maxOutputTokens: number;
  supportsToolCalling?: boolean;
  supportsWebSearch?: boolean;
  supportsVision?: boolean;
  supportsFileInput?: boolean;
  supportsImageOutput?: boolean;
  supportsVideoOutput?: boolean;
}

export type ModelSpecMap = Partial<
  Record<string, Record<string, ModelSpec>>
>;

export const DEFAULT_MODEL_SPEC: ModelSpec = {
  name: "",
  contextWindow: 128_000,
  reasoning: false,
  maxOutputTokens: 4_096,
  supportsToolCalling: true,
  supportsVision: false,
  supportsFileInput: true,
  supportsImageOutput: false,
  supportsVideoOutput: false,
  supportsWebSearch: false,
};

/** 字段级合并：用户覆盖优先，缺失字段回退内置。 */
export function mergeModelSpec(
  builtin: ModelSpec | undefined,
  userOverride: Partial<ModelSpec> | undefined
): ModelSpec {
  const base = builtin ?? DEFAULT_MODEL_SPEC;
  if (!userOverride) return base;
  const reasoning =
    userOverride.reasoning !== undefined
      ? userOverride.reasoning
      : base.reasoning;
  const supportsToolCalling =
    userOverride.supportsToolCalling !== undefined
      ? userOverride.supportsToolCalling
      : (base.supportsToolCalling ?? true);
  const supportsVision =
    userOverride.supportsVision !== undefined
      ? userOverride.supportsVision
      : (base.supportsVision ?? false);
  const supportsFileInput =
    userOverride.supportsFileInput !== undefined
      ? userOverride.supportsFileInput
      : (base.supportsFileInput ?? true);
  const supportsImageOutput =
    userOverride.supportsImageOutput !== undefined
      ? userOverride.supportsImageOutput
      : (base.supportsImageOutput ?? false);
  const supportsVideoOutput =
    userOverride.supportsVideoOutput !== undefined
      ? userOverride.supportsVideoOutput
      : (base.supportsVideoOutput ?? false);
  const supportsWebSearch =
    userOverride.supportsWebSearch !== undefined
      ? userOverride.supportsWebSearch
      : (base.supportsWebSearch ?? false);

  return {
    name: userOverride.name?.trim() || base.name,
    contextWindow:
      Number.isFinite(userOverride.contextWindow) && userOverride.contextWindow! > 0
        ? Math.floor(userOverride.contextWindow!)
        : base.contextWindow,
    reasoning,
    ...(reasoning &&
    (userOverride.defaultReasoning
      ? REASONING_LEVELS.includes(userOverride.defaultReasoning)
      : base.defaultReasoning)
      ? {
          defaultReasoning: (userOverride.defaultReasoning ??
            base.defaultReasoning) as ReasoningLevel,
        }
      : {}),
    maxOutputTokens:
      Number.isFinite(userOverride.maxOutputTokens) &&
      userOverride.maxOutputTokens! > 0
        ? Math.floor(userOverride.maxOutputTokens!)
        : base.maxOutputTokens,
    supportsToolCalling,
    supportsVision,
    supportsFileInput,
    supportsImageOutput,
    supportsVideoOutput,
    supportsWebSearch,
  };
}

/** 解析完整模型 ref（"deepseek:deepseek-v4-flash"）为 provider 分组 key。 */
export function resolveSpecKey(
  modelRef: string
): { provider: string; key: string } | null {
  const trimmed = modelRef.trim();
  if (trimmed.startsWith("custom:")) {
    const rest = trimmed.slice("custom:".length);
    const separator = rest.indexOf(":");
    if (separator <= 0) return null;
    return {
      provider: "custom",
      key: `${rest.slice(0, separator)}:${rest.slice(separator + 1)}`,
    };
  }
  for (const prefix of ["workers-ai:", "deepseek:", "alibaba:"]) {
    if (trimmed.startsWith(prefix)) {
      return { provider: prefix.slice(0, -1), key: trimmed.slice(prefix.length) };
    }
  }
  if (trimmed.startsWith("@cf/")) return { provider: "workers-ai", key: trimmed };
  return null;
}
