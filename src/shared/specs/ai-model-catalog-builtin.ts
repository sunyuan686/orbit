export type ReasoningLevel = "none" | "low" | "medium" | "high";

export interface BuiltinModelCatalogItem {
  id: string;
  label: string;
  description: string;
  contextWindow: number;
  reasoning: boolean;
  defaultReasoning?: ReasoningLevel;
  maxOutputTokens: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  supportsVision?: boolean;
  recommended?: boolean;
}

export type BuiltinProviderCatalog = Record<
  "workers-ai" | "deepseek" | "alibaba",
  BuiltinModelCatalogItem[]
>;

export const BUILTIN_PROVIDER_CATALOG: BuiltinProviderCatalog = {
  "workers-ai": [
    {
      id: "@cf/zai-org/glm-4.7-flash",
      label: "@cf/zai-org/glm-4.7-flash",
      description: "智谱 GLM 4.7 Flash · 中文友好，响应迅速，支持推理与工具调用",
      contextWindow: 131_072,
      reasoning: true,
      defaultReasoning: "low",
      maxOutputTokens: 4_096,
      capabilities: ["工具调用", "推理"],
      supportsToolCalling: true,
      recommended: true,
    },
    {
      id: "@cf/openai/gpt-oss-20b",
      label: "@cf/openai/gpt-oss-20b",
      description: "OpenAI 开源权重 · 平衡速度与质量，极速响应",
      contextWindow: 128_000,
      reasoning: false,
      maxOutputTokens: 4_096,
      capabilities: ["工具调用", "极速推流"],
      supportsToolCalling: true,
      recommended: true,
    }
  ],
  deepseek: [
    {
      id: "deepseek-v4-pro",
      label: "deepseek-v4-pro",
      description: "Deepseek 旗舰模型",
      contextWindow: 64_000,
      reasoning: true,
      defaultReasoning: "medium",
      maxOutputTokens: 8_192,
      capabilities: ["深度思考", "逻辑推演"],
      supportsToolCalling: false,
      recommended: true,
    },
    {
      id: "deepseek-v4-flash",
      label: "deepseek-v4-flash",
      description: "DeepSeek V4 Flash 敏捷版 · 高并发、低时延极速生成",
      contextWindow: 131_072,
      reasoning: true,
      defaultReasoning: "low",
      maxOutputTokens: 8_192,
      capabilities: ["极速响应", "深度思考"],
      supportsToolCalling: true,
    },
  ],
  alibaba: [
    {
      id: "qwen3.8-max",
      label: "qwen3.8-max",
      description: "通义千问 Qwen3.8-Max 旗舰 · 2.4万亿参数 MoE 架构，强逻辑、自主编程与超大上下文",
      contextWindow: 1_000_000,
      reasoning: true,
      defaultReasoning: "medium",
      maxOutputTokens: 8_192,
      capabilities: ["2.4万亿MoE", "超长文本", "深度思考"],
      supportsToolCalling: true,
      recommended: true,
    },
    {
      id: "qwen3.7-plus",
      label: "qwen3.7-plus",
      description: "通义千问 Qwen3.7-Plus 高性能 · 深度思考与复杂工具调用能力",
      contextWindow: 131_072,
      reasoning: true,
      defaultReasoning: "low",
      maxOutputTokens: 8_192,
      capabilities: ["深度思考", "工具调用", "视觉理解"],
      supportsToolCalling: true,
      recommended: true,
    },
    {
      id: "qwen3.7-flash",
      label: "qwen3.7-flash",
      description: "通义千问 Qwen3.7-Flash 极速版 · 高并发、低延时敏捷响应",
      contextWindow: 131_072,
      reasoning: false,
      maxOutputTokens: 8_192,
      capabilities: ["极速推流", "高并发", "多模态"],
      supportsToolCalling: true,
    },
    {
      id: "qwen3.5-plus",
      label: "qwen3.5-plus",
      description: "通义千问 Qwen3.5-Plus 稳态大模型 · 通用对话与长文润色",
      contextWindow: 131_072,
      reasoning: false,
      maxOutputTokens: 8_192,
      capabilities: ["通用对话", "稳态生成"],
      supportsToolCalling: true,
    }
  ],
};
