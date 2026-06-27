import { eq, and, isNull } from "drizzle-orm";
import { entry } from "../db/schema.js";
import { toPlainText } from "../lib/plain-text.js";
import type { AiContextMode } from "./ai-chat-store.js";

export interface AiPromptContext {
  mode: AiContextMode;
  articleId?: string;
}

export async function buildSystemPrompt(
  db: any,
  context: AiPromptContext
): Promise<string> {
  const lines = [
    "你是 Orbit 情侣空间助手，语气温暖、简洁，使用中文回复。",
    "空间内有两位作者：小圆子与小麟子。引用内容时请说明来源标题与日期，不要编造未检索到的信息。",
    "你可以通过工具搜索日记、时间线、留言、信件与备忘录；不确定时请先调用 search_entries。",
    "不要一次塞入大量原文；按需检索、归纳回答。",
  ];

  if (context.mode === "article" && context.articleId) {
    const article = await db
      .select({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        author: entry.author,
        entryDate: entry.entryDate,
        bodyText: entry.bodyText,
        body: entry.body,
      })
      .from(entry)
      .where(and(eq(entry.id, context.articleId), isNull(entry.deletedAt)))
      .get();

    if (article) {
      const raw = article.bodyText || toPlainText(article.body ?? "");
      const summary = raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
      lines.push(
        "",
        "当前用户正在阅读的文章：",
        `- 标题：${article.title ?? "（无标题）"}`,
        `- 类型：${article.type}`,
        `- 作者：${article.author}`,
        `- 日期：${article.entryDate ?? "未知"}`,
        `- 摘要：${summary || "（空）"}`,
        "如需全文可调用 get_entry。"
      );
    }
  }

  return lines.join("\n");
}
