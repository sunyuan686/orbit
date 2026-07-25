import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { entry, memo } from "../db/schema.js";
import { toPlainText } from "../lib/plain-text.js";
import { createSearchService } from "./search.js";

const MAX_TOOL_CHARS = 8_000;
/** Max chars for a single search snippet sent to the model. */
const MAX_SNIPPET_CHARS = 500;

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

async function executeTavilySearch(query: string, apiKey: string) {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      api_key: apiKey,
      query,
      search_depth: "basic",
      max_results: 5,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Tavily API 响应异常 (${res.status}): ${truncate(errorText, 200)}`);
  }

  const data = (await res.json()) as {
    results?: Array<{ title: string; url: string; content: string }>;
  };

  return (data.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: truncate(item.content || "", 1500),
    source: "tavily",
  }));
}

async function executeBraveSearch(query: string, apiKey: string) {
  const url = new URL("https://api.search.brave.com/res/v1/web/search");
  url.searchParams.set("q", query);
  url.searchParams.set("count", "5");

  const res = await fetch(url.toString(), {
    headers: {
      Accept: "application/json",
      "X-Subscription-Token": apiKey,
    },
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Brave Search API 响应异常 (${res.status}): ${truncate(errorText, 200)}`);
  }

  const data = (await res.json()) as {
    web?: {
      results?: Array<{ title: string; url: string; description?: string }>;
    };
  };

  return (data.web?.results || []).map((item) => ({
    title: item.title,
    url: item.url,
    snippet: truncate(item.description || "", 1500),
    source: "brave",
  }));
}

export function createAiTools(
  db: any,
  settingsMap?: Record<string, string>,
  env?: Record<string, string>
) {
  const search = createSearchService(db);

  return {
    search_entries: tool({
      description:
        "搜索情侣空间内的日记、时间线、留言、信件与备忘录。返回标题、日期与摘要片段。",
      inputSchema: z.object({
        query: z.string().min(1),
        type: z
          .enum(["diary", "timeline", "message", "letter", "memo"])
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

        // Use head+tail truncation so both the opening context and the
        // closing emotional conclusion of a diary/letter are preserved.
        const bodyText = headTailTruncate(
          row.bodyText || toPlainText(row.body ?? "")
        );
        return {
          title: row.title,
          type: row.type,
          author: row.author,
          entryDate: row.entryDate,
          bodyText,
          truncated: (row.bodyText || toPlainText(row.body ?? "")).length > MAX_TOOL_CHARS,
        };
      },
    }),

    list_memos: tool({
      description: "列出备忘录标题与更新时间，不含全文。",
      inputSchema: z.object({
        limit: z.number().int().min(1).max(50).optional(),
      }),
      execute: async ({ limit }) => {
        const rows = await db
          .select({
            key: memo.key,
            title: memo.title,
            updatedAt: memo.updatedAt,
          })
          .from(memo)
          .where(isNull(memo.deletedAt))
          .orderBy(desc(memo.updatedAt))
          .limit(limit ?? 20);

        return rows.map((row: { key: string; title: string; updatedAt: number }) => ({
          key: row.key,
          title: row.title,
          updatedAt: row.updatedAt,
        }));
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

        if (!tavilyKey && !braveKey) {
          return {
            error:
              "尚未配置 Web 搜索 API Key。请在环境变量或系统设置中配置 TAVILY_API_KEY 或 BRAVE_SEARCH_API_KEY。",
          };
        }

        let targetProvider = provider;
        if (targetProvider === "auto") {
          targetProvider = tavilyKey ? "tavily" : "brave";
        }

        try {
          if (targetProvider === "tavily" && tavilyKey) {
            const results = await executeTavilySearch(query, tavilyKey);
            return { query, provider: "tavily", results };
          }
          if (targetProvider === "brave" && braveKey) {
            const results = await executeBraveSearch(query, braveKey);
            return { query, provider: "brave", results };
          }
          if (tavilyKey) {
            const results = await executeTavilySearch(query, tavilyKey);
            return { query, provider: "tavily", results };
          }
          if (braveKey) {
            const results = await executeBraveSearch(query, braveKey);
            return { query, provider: "brave", results };
          }
          return { error: "所选搜索引擎 API Key 未配置" };
        } catch (err: any) {
          if (targetProvider === "tavily" && braveKey) {
            try {
              const results = await executeBraveSearch(query, braveKey);
              return { query, provider: "brave (fallback)", results };
            } catch (fallbackErr: any) {
              return {
                error: `Tavily 搜索失败: ${err.message}; 自动降级 Brave 也失败: ${fallbackErr.message}`,
              };
            }
          }
          return { error: `Web 搜索失败: ${err.message}` };
        }
      },
    }),
  };
}
