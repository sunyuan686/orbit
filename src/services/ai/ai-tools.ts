import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { entry } from "../../db/schema.js";
import { toPlainText } from "../../lib/plain-text.js";
import { createSearchService } from "../content/search.js";
import { createLogger } from "../../lib/logger.js";
import {
  executeWriteContentInput,
  type ContentWriteActor,
} from "../content/content-write.js";
import { executeWebSearch } from "./web-search-provider.js";

const log = createLogger("ai-tools");

const MAX_TOOL_CHARS = 8_000;
/** Max chars for a single search snippet sent to the model. */
const MAX_SNIPPET_CHARS = 500;

/**
 * AI 工具统一展示元数据（中文名称、图标及描述）
 */
export const AI_TOOL_METADATA = {
  search_entries: {
    displayName: "空间搜索",
    icon: "🔍",
    description: "搜索空间内的动态与信件",
  },
  get_entry: {
    displayName: "读取文章",
    icon: "📖",
    description: "按 ID 读取单篇内容正文",
  },
  write_content: {
    displayName: "写入内容",
    icon: "✍️",
    description: "创建、修改或删除空间动态或信件",
  },
  web_search: {
    displayName: "联网搜索",
    icon: "🌐",
    description: "在互联网上搜索外部实时信息与公开知识",
  },
} as const;

export type AiToolName = keyof typeof AI_TOOL_METADATA;

/**
 * 格式化输出带图标的工具友好展示名（如 "🔍 空间搜索"）
 */
export function formatToolDisplayName(toolName: string): string {
  const meta = (AI_TOOL_METADATA as Record<string, { icon: string; displayName: string }>)[
    toolName
  ];
  return meta ? `${meta.icon} ${meta.displayName}` : `🛠️ ${toolName}`;
}

/** Single-end truncation — use for short strings like error messages. */
function truncate(value: string, max = MAX_TOOL_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…（已截断）`;
}

/**
 * Head + Tail dual-end truncation (Codex CLI style).
 * Preserves the beginning (context / setup) and the end (conclusions /
 * error stack traces) while dropping the middle bulk.
 */
function headTailTruncate(value: string, max = MAX_TOOL_CHARS): string {
  if (value.length <= max) return value;
  const half = Math.floor(max / 2);
  const head = value.slice(0, half);
  const tail = value.slice(-half);
  const removed = value.length - head.length - tail.length;
  return `${head}\n\n…（省略 ${removed} 字符）…\n\n${tail}`;
}

export interface CreateAiToolsOptions {
  settingsMap?: Record<string, string>;
  env?: Record<string, string>;
  actor?: ContentWriteActor;
}

export function createAiTools(
  db: any,
  options: CreateAiToolsOptions = {}
) {
  const { settingsMap, env, actor } = options;
  const search = createSearchService(db);

  return {
    search_entries: tool({
      description:
        "搜索情侣空间内的动态与信件。返回标题、日期与摘要片段。",
      inputSchema: z.object({
        query: z.string().min(1),
        type: z
          .enum(["moment", "letter"])
          .optional(),
        limit: z.number().int().min(1).max(10).optional(),
      }),
      execute: async ({ query, type, limit }) => {
        const results = await search.search(query, {
          limit: limit ?? 5,
          type,
        });
        return results.map((item) => ({
          id: item.id,
          type: item.type,
          title: item.title,
          entryDate: item.entryDate,
          // Cap snippet length to keep search results token-efficient.
          // Full text is available via get_entry() when needed.
          snippet: truncate(item.snippet ?? "", MAX_SNIPPET_CHARS),
        }));
      },
    }),

    get_entry: tool({
      description: "按 id 获取单篇文章或备忘录的全文（纯文本）。",
      inputSchema: z.object({
        id: z.string().min(1),
      }),
      execute: async ({ id }) => {
        const row = await db
          .select({
            id: entry.id,
            title: entry.title,
            type: entry.type,
            author: entry.author,
            entryDate: entry.entryDate,
            bodyText: entry.bodyText,
            body: entry.body,
            deletedAt: entry.deletedAt,
          })
          .from(entry)
          .where(eq(entry.id, id))
          .get();

        if (!row || row.deletedAt) {
          return { error: "不存在" };
        }

        const rawBody = row.bodyText || toPlainText(row.body ?? "");
        const bodyText = headTailTruncate(rawBody);
        return {
          id: row.id,
          title: row.title,
          type: row.type,
          author: row.author,
          entryDate: row.entryDate,
          bodyText,
          truncated: rawBody.length > MAX_TOOL_CHARS,
        };
      },
    }),

    write_content: tool({
      description:
        "创建、更新或删除情侣空间内的动态与信件。创建与更新时 body 为 Markdown 正文；删除仅软删除且只能删除自己创建的内容。",
      inputSchema: z.object({
        action: z.enum(["create", "update", "delete"]).describe("操作类型"),
        type: z
          .enum(["moment", "letter"])
          .optional()
          .describe("内容类型；create 时必填"),
        id: z.string().optional().describe("内容 ID；update/delete 时必填"),
        title: z.string().optional().describe("标题"),
        body: z.string().optional().describe("Markdown 正文"),
        date: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe("条目日期 YYYY-MM-DD（北京时间）。记录今天的内容时省略，由系统使用当天日期"),
        parentId: z
          .string()
          .optional()
          .describe("父条目 ID；用于信件回信或留言回复"),
      }),
      execute: async (input) => {
        if (!actor) {
          return { error: "当前会话未绑定用户身份，无法写入内容" };
        }

        try {
          const result = await executeWriteContentInput(db, actor, input);
          if (!result.ok) {
            return { error: result.error ?? "写入失败" };
          }
          return result;
        } catch (err: any) {
          log.error("write_content failed", err, {
            action: input.action,
            type: input.type,
            id: input.id,
          });
          return { error: `写入失败: ${err.message || "未知错误"}` };
        }
      },
    }),

    web_search: tool({
      description:
        "在互联网上搜索外部信息、最新新闻、景点旅游指南、公共知识等空间内部数据未涵盖的内容。",
      inputSchema: z.object({
        query: z.string().min(1).describe("搜索关键词或文本"),
        provider: z
          .enum(["auto", "tavily", "brave"])
          .optional()
          .describe("搜索引擎 Provider，默认 auto"),
      }),
      execute: async ({ query, provider = "auto" }) => {
        const tavilyKey =
          env?.TAVILY_API_KEY ||
          process.env.TAVILY_API_KEY ||
          settingsMap?.tavily_api_key;
        const braveKey =
          env?.BRAVE_SEARCH_API_KEY ||
          process.env.BRAVE_SEARCH_API_KEY ||
          settingsMap?.brave_search_api_key;

        return executeWebSearch({
          query,
          provider,
          tavilyKey,
          braveKey,
        });
      },
    }),
  };
}
