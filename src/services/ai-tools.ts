import { tool } from "ai";
import { z } from "zod";
import { and, desc, eq, isNull } from "drizzle-orm";
import { entry, memo } from "../db/schema.js";
import { toPlainText } from "../lib/plain-text.js";
import { createSearchService } from "./search.js";

const MAX_TOOL_CHARS = 8_000;

function truncate(value: string, max = MAX_TOOL_CHARS): string {
  if (value.length <= max) return value;
  return `${value.slice(0, max)}…（已截断）`;
}

export function createAiTools(db: any) {
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
          snippet: item.snippet ?? "",
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

        const bodyText = truncate(
          row.bodyText || toPlainText(row.body ?? "")
        );
        return {
          title: row.title,
          type: row.type,
          author: row.author,
          entryDate: row.entryDate,
          bodyText,
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
  };
}
