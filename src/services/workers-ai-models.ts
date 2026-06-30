import type { AiRuntimeEnv } from "./ai-model.js";

export interface WorkersAiModelOption {
  id: string;
  label: string;
  description: string;
  task: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  recommended?: boolean;
}

export interface WorkersAiModelsResponse {
  models: WorkersAiModelOption[];
  source: "catalog" | "fallback";
}

interface CfModelProperty {
  property_id: string;
  value: unknown;
}

interface CfCatalogModel {
  name: string;
  description: string;
  properties?: CfModelProperty[];
  tags?: string[];
  task?: { name?: string };
}

interface CfModelsSearchResponse {
  success: boolean;
  result?: CfCatalogModel[];
}

const CACHE_TTL_MS = 60 * 60 * 1000;
const PER_PAGE = 100;

const RECOMMENDED_MODEL_IDS = new Set([
  "@cf/zai-org/glm-4.7-flash",
  "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
  "@cf/openai/gpt-oss-20b",
]);

const CAPABILITY_LABELS: Record<string, string> = {
  function_calling: "工具调用",
  reasoning: "推理",
  vision: "视觉",
  lora: "LoRA",
  beta: "实验",
  batch: "批处理",
};

const TASK_LABELS: Record<string, string> = {
  "Text Generation": "文本生成",
  "Text Embeddings": "文本嵌入",
  "Text-to-Image": "文生图",
  "Text-to-Speech": "语音合成",
  "Automatic Speech Recognition": "语音识别",
  "Image Classification": "图像分类",
  "Object Detection": "目标检测",
  "Image-to-Text": "图像理解",
  "Translation": "翻译",
  "Summarization": "摘要",
};

export const FALLBACK_WORKERS_AI_MODELS: WorkersAiModelOption[] = [
  {
    id: "@cf/zai-org/glm-4.7-flash",
    label: "@cf/zai-org/glm-4.7-flash",
    description:
      "中文友好、支持工具调用，131k 上下文。Orbit 默认推荐。",
    task: "Text Generation",
    contextWindow: 131_072,
    capabilities: ["工具调用", "推理"],
    supportsToolCalling: true,
    recommended: true,
  },
  {
    id: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    label: "@cf/meta/llama-3.3-70b-instruct-fp8-fast",
    description: "Meta 70B，推理更强，支持工具调用。",
    task: "Text Generation",
    contextWindow: 24_000,
    capabilities: ["工具调用", "批处理"],
    supportsToolCalling: true,
    recommended: true,
  },
  {
    id: "@cf/openai/gpt-oss-20b",
    label: "@cf/openai/gpt-oss-20b",
    description: "OpenAI 开源权重，平衡速度与质量。",
    task: "Text Generation",
    capabilities: ["工具调用", "推理"],
    supportsToolCalling: true,
    recommended: true,
  },
  {
    id: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    label: "@cf/mistralai/mistral-small-3.1-24b-instruct",
    description: "Mistral 24B，多语言对话。",
    task: "Text Generation",
    capabilities: ["工具调用"],
    supportsToolCalling: true,
  },
  {
    id: "@cf/qwen/qwen3-30b-a3b-fp8",
    label: "@cf/qwen/qwen3-30b-a3b-fp8",
    description: "Qwen3，推理与工具调用。",
    task: "Text Generation",
    capabilities: ["工具调用", "推理", "批处理"],
    supportsToolCalling: true,
  },
];

let catalogCache: { expiresAt: number; models: WorkersAiModelOption[] } | null =
  null;

function getProperty(model: CfCatalogModel, propertyId: string): string | undefined {
  const prop = model.properties?.find((p) => p.property_id === propertyId);
  if (prop == null) return undefined;
  return String(prop.value);
}

function extractCapabilities(model: CfCatalogModel): string[] {
  const caps: string[] = [];

  for (const [propertyId, label] of Object.entries(CAPABILITY_LABELS)) {
    if (getProperty(model, propertyId) === "true") {
      caps.push(label);
    }
  }

  return caps;
}

function toOption(model: CfCatalogModel): WorkersAiModelOption {
  const id = model.name;
  const contextRaw = getProperty(model, "context_window");
  const contextWindow = contextRaw ? Number(contextRaw) : undefined;
  const supportsToolCalling = getProperty(model, "function_calling") === "true";

  return {
    id,
    label: id,
    description: model.description,
    task: model.task?.name ?? "Other",
    contextWindow: Number.isFinite(contextWindow) ? contextWindow : undefined,
    capabilities: extractCapabilities(model),
    supportsToolCalling,
    recommended: RECOMMENDED_MODEL_IDS.has(id),
  };
}

function taskSortKey(task: string): string {
  if (task === "Text Generation") return "0";
  return `1-${task}`;
}

function sortModels(models: WorkersAiModelOption[]): WorkersAiModelOption[] {
  return [...models].sort((a, b) => {
    const taskCmp = taskSortKey(a.task).localeCompare(taskSortKey(b.task));
    if (taskCmp !== 0) return taskCmp;
    if (a.recommended !== b.recommended) return a.recommended ? -1 : 1;
    return a.label.localeCompare(b.label);
  });
}

export function getWorkersAiModelCredentials(
  env: AiRuntimeEnv = process.env as AiRuntimeEnv
): { accountId: string; apiToken: string } | null {
  const accountId = (env.CF_ACCOUNT_ID ?? process.env.CF_ACCOUNT_ID ?? "").trim();
  const apiToken = (env.CF_API_TOKEN ?? process.env.CF_API_TOKEN ?? "").trim();
  if (!accountId || !apiToken) return null;
  return { accountId, apiToken };
}

async function fetchCatalogPage(
  credentials: { accountId: string; apiToken: string },
  page: number
): Promise<CfCatalogModel[]> {
  const params = new URLSearchParams({
    per_page: String(PER_PAGE),
    page: String(page),
  });

  const response = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${credentials.accountId}/ai/models/search?${params}`,
    {
      headers: {
        Authorization: `Bearer ${credentials.apiToken}`,
        "Content-Type": "application/json",
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Workers AI catalog request failed (${response.status})`);
  }

  const payload = (await response.json()) as CfModelsSearchResponse;
  if (!payload.success || !Array.isArray(payload.result)) {
    throw new Error("Workers AI catalog response invalid");
  }

  return payload.result;
}

async function fetchAllCatalogModels(
  credentials: { accountId: string; apiToken: string }
): Promise<CfCatalogModel[]> {
  const models: CfCatalogModel[] = [];
  let page = 1;

  while (true) {
    const batch = await fetchCatalogPage(credentials, page);
    models.push(...batch);
    if (batch.length < PER_PAGE) break;
    page += 1;
  }

  return models;
}

export async function listWorkersAiChatModels(
  credentials: { accountId: string; apiToken: string } | null
): Promise<WorkersAiModelsResponse> {
  if (catalogCache && catalogCache.expiresAt > Date.now()) {
    return { models: catalogCache.models, source: "catalog" };
  }

  if (!credentials) {
    return { models: FALLBACK_WORKERS_AI_MODELS, source: "fallback" };
  }

  try {
    const raw = await fetchAllCatalogModels(credentials);
    const models = sortModels(raw.map(toOption));

    if (models.length === 0) {
      return { models: FALLBACK_WORKERS_AI_MODELS, source: "fallback" };
    }

    catalogCache = {
      models,
      expiresAt: Date.now() + CACHE_TTL_MS,
    };

    return { models, source: "catalog" };
  } catch {
    return { models: FALLBACK_WORKERS_AI_MODELS, source: "fallback" };
  }
}

export function formatWorkersAiTaskLabel(task: string): string {
  return TASK_LABELS[task] ?? task;
}
