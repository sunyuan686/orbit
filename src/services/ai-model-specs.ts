/**
 * Orbit 模型规格注册表：每个模型的静态能力事实 + 用户覆盖。
 *
 * 参照主流实践（ai-chatbot models.ts / OpenCode models.dev / Cherry Studio
 * Model.contextWindow）：模型元数据（上下文窗口、是否支持思考、输出预算）
 * 是厂商公开事实，用户可在设置面板按 provider 分组维护覆盖值。
 *
 * 读取优先级：用户覆盖（settings.ai_model_specs）> 内置默认 > 保守兜底。
 * 存储格式与 ai_connections 同构：settings 表 KV + JSON 字符串。
 */
import type { AiProvider } from "../app-settings.js";

/** 思考档位（与 AI SDK 顶层 reasoning 参数收敛，适配所有 provider） */
export type ReasoningLevel = "none" | "low" | "medium" | "high";

export const REASONING_LEVELS: readonly ReasoningLevel[] = [
  "none",
  "low",
  "medium",
  "high",
];

export function isReasoningLevel(value: unknown): value is ReasoningLevel {
  return (
    typeof value === "string" &&
    (REASONING_LEVELS as readonly string[]).includes(value)
  );
}

export interface ModelSpec {
  /** 显示名（前端面板/模型选择器用） */
  name: string;
  /** 上下文窗口上限（tokens）——Context 档位按它裁剪 */
  contextWindow: number;
  /** 单次输出 token 上限（provider 构造默认） */
  maxOutputTokens: number;

  // FEATURES (模型特性)
  /** 模型是否支持思考（reasoning） */
  reasoning: boolean;
  /** 默认思考档位（仅 reasoning 模型） */
  defaultReasoning?: ReasoningLevel;
  /** 是否支持工具调用 */
  supportsToolCalling?: boolean;
  /** 是否支持联网搜索 */
  supportsWebSearch?: boolean;

  // INPUT (输入能力)
  /** 是否支持图片/视觉输入 */
  supportsVision?: boolean;
  /** 是否支持文件/文档输入 */
  supportsFileInput?: boolean;

  // OUTPUT (输出能力)
  /** 是否支持图片生成输出 */
  supportsImageOutput?: boolean;
  /** 是否支持视频生成输出 */
  supportsVideoOutput?: boolean;
}

/**
 * 按 provider 分组的模型规格表。
 * 组内 key：内置 provider → 纯 modelId（如 "deepseek-v4-flash"）；
 * custom → "connectionId:modelId"（与 parseModelRef 的 key 规则一致）。
 */
export type ModelSpecMap = Partial<Record<AiProvider, Record<string, ModelSpec>>>;

import { BUILTIN_PROVIDER_CATALOG } from "./ai-model-catalog-builtin.js";

/** 内置模型默认规格（由统一的 BUILTIN_PROVIDER_CATALOG 派生）。 */
export const BUILTIN_MODEL_SPECS: ModelSpecMap = Object.fromEntries(
  Object.entries(BUILTIN_PROVIDER_CATALOG).map(([provider, models]) => [
    provider,
    Object.fromEntries(
      models.map((m) => [
        m.id,
        {
          name: m.label,
          contextWindow: m.contextWindow,
          reasoning: m.reasoning,
          ...(m.defaultReasoning ? { defaultReasoning: m.defaultReasoning } : {}),
          maxOutputTokens: m.maxOutputTokens,
          supportsToolCalling: m.supportsToolCalling,
          supportsVision: m.supportsVision ?? false,
          supportsFileInput: true,
          supportsImageOutput: false,
          supportsVideoOutput: false,
          supportsWebSearch: false,
        },
      ])
    ),
  ])
) as ModelSpecMap;

/** 未收录模型的保守兜底（新模型/自定义连接）。 */
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

export function parseModelSpecs(raw: string | undefined): ModelSpecMap {
  if (!raw?.trim()) return {};
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      return {};
    }
    const result: ModelSpecMap = {};
    for (const [provider, models] of Object.entries(parsed)) {
      if (typeof models !== "object" || models === null || Array.isArray(models)) {
        continue;
      }
      const group: Record<string, ModelSpec> = {};
      for (const [modelId, spec] of Object.entries(models)) {
        if (typeof spec !== "object" || spec === null || Array.isArray(spec)) {
          continue;
        }
        const s = spec as Record<string, unknown>;
        const contextWindow = Number(s.contextWindow);
        const maxOutputTokens = Number(s.maxOutputTokens);
        if (
          typeof s.name !== "string" ||
          !Number.isFinite(contextWindow) ||
          contextWindow <= 0 ||
          !Number.isFinite(maxOutputTokens) ||
          maxOutputTokens <= 0
        ) {
          continue;
        }
        const reasoning = Boolean(s.reasoning);
        const defaultReasoning = s.defaultReasoning;
        const supportsToolCalling = s.supportsToolCalling !== undefined ? Boolean(s.supportsToolCalling) : true;
        const supportsVision = Boolean(s.supportsVision);
        const supportsFileInput = s.supportsFileInput !== undefined ? Boolean(s.supportsFileInput) : true;
        const supportsImageOutput = Boolean(s.supportsImageOutput);
        const supportsVideoOutput = Boolean(s.supportsVideoOutput);
        const supportsWebSearch = Boolean(s.supportsWebSearch);

        group[modelId] = {
          name: s.name,
          contextWindow: Math.floor(contextWindow),
          reasoning,
          ...(reasoning && isReasoningLevel(defaultReasoning)
            ? { defaultReasoning }
            : {}),
          maxOutputTokens: Math.floor(maxOutputTokens),
          supportsToolCalling,
          supportsVision,
          supportsFileInput,
          supportsImageOutput,
          supportsVideoOutput,
          supportsWebSearch,
        };
      }
      if (Object.keys(group).length > 0) {
        result[provider as AiProvider] = group;
      }
    }
    return result;
  } catch {
    return {};
  }
}

export function serializeModelSpecs(specs: ModelSpecMap): string {
  return JSON.stringify(specs);
}

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
      ? isReasoningLevel(userOverride.defaultReasoning)
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

export function resolveModelSpec(
  userSpecs: ModelSpecMap,
  provider: AiProvider,
  modelId: string
): ModelSpec {
  const userOverride = userSpecs[provider]?.[modelId];
  return mergeModelSpec(BUILTIN_MODEL_SPECS[provider]?.[modelId], userOverride);
}

/**
 * 上下文 token 预算 = 窗口 × 0.93，保留 ~7% 给模型输出。
 * 与既有 60 k 窗口 → 56 k 预算的保守比例保持一致。
 */
export function resolveMessageTokenBudget(contextWindow: number): number {
  return Math.max(4_000, Math.floor(contextWindow * 0.93));
}
