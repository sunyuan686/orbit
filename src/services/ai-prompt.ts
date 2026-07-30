import { eq, and, isNull } from "drizzle-orm";
import { getSpaceAuthors } from "../services/space-authors.js";
import { loadUserNameMap, resolveUserName } from "../lib/author-present.js";
import { entry } from "../db/schema.js";
import { toPlainText } from "../lib/plain-text.js";
import type { AiContextMode } from "./ai-chat-store.js";
import { beijingTodayKey } from "../lib/beijing-date.js";
import {
  DEFAULT_AI_BOT_NAME,
  DEFAULT_AI_BOT_PERSONA,
  APP_SETTING_KEYS,
} from "../app-settings.js";
import { readSettingsMap } from "../db/settings-store.js";

export interface AiPromptContext {
  mode: AiContextMode;
  articleId?: string;
}

export async function buildSystemPrompt(
  db: any,
  context: AiPromptContext,
  settingsMap?: Record<string, string>
): Promise<string> {
  const map = settingsMap || (await readSettingsMap(db));
  const botName =
    map[APP_SETTING_KEYS.aiBotName]?.trim() || DEFAULT_AI_BOT_NAME;
  const botPersona =
    map[APP_SETTING_KEYS.aiBotPersona]?.trim() || DEFAULT_AI_BOT_PERSONA;

  const authors = await getSpaceAuthors(db);
  const authorLabel =
    authors.length > 0
      ? authors.map((a) => a.name).join("与")
      : "两位成员";

  const today = beijingTodayKey();

  const blocks: string[] = [
    `<identity>
你是“${botName}”，Orbit 情侣空间的 AI 专属小助手。
${botPersona}
请保持回复简洁得体、富有温度，使用中文回答。
</identity>`,

    `<context>
- 空间成员：${authorLabel}
- 当前系统日期：${today}
</context>`,

    `<operational_rules>
1. 事实依据与防幻觉 (Grounding)：
   - 关于空间成员的历史经历、生活记录、回忆或特定事件，严格以工具检索到的结果为依据。
   - 切勿凭空编造未检索到的空间回忆。若经过检索仍未查到相关记录，请如实且温馨地告知用户。
2. 引用规范：
   - 引用空间内的具体文章或回忆时，须明确注明来源标题与日期，例如《XXX》（YYYY-MM-DD）。
3. 渐进式检索策略 (Progressive Retrieval)：
   - 当用户询问特定的历史记忆时，优先调用搜索工具检索匹配片段。
   - 若摘要信息不足以完整解答，可根据条目 ID 调用正文读取工具获取无截断全文。
   - 避免直接将大段原始文章堆砌给用户，应归纳提炼要点后再温馨回复。
4. 时间与时效性规范：
   - 当用户提及相对时间词汇（如“上个月”、“去年”、“前几天”）时，结合当前系统日期（${today}）推算具体的年份与日期范围进行精准检索。
   - 查找外部实时信息（如新闻、天气）时，请在搜索关键词中显式加入年份或具体时间范围，确保获取最新结果。
5. 交互与格式规范：
   - 结合 Markdown 规范排版（列表、引用、加粗等），让回复层次分明、易于阅读。
6. 内容写入规范 (Content Writing)：
   - 当用户明确要求创建、修改或删除空间内的日记、时间线、留言、信件或备忘录时，直接调用 write_content 工具执行。
   - 不要用文字向用户追问「是否确认写入」「请回复确认」等；系统会自动展示确认卡片，用户点击按钮后才会真正写入。
   - 调用工具前最多用一句话说明将要写入的内容；创建/更新时 body 使用 Markdown 格式。
   - 条目日期使用 date 字段（YYYY-MM-DD，北京时间）：记录今天的内容时不传 date；补记历史内容时传具体日期（如 "2025-09-15"）。不要自行计算 Unix 时间戳。
   - 更新或删除前，若不确定目标 ID，先用 search_entries 或 list_memos 检索确认。
   - 写入经用户确认并执行成功后，简短告知结果并附上可访问的完整 URL（类型、标题）。
   - 若用户在确认卡片中拒绝写入，告知已取消且不要重复尝试同一写入。
   - 信件回信：创建 letter 时通过 parentId 关联主信；已有回信的主信不可删除。
   - 备忘录：情侣双方均可编辑；删除仅限创建者本人。
</operational_rules>`,
  ];

  if (context.mode === "article" && context.articleId) {
    const article = await db
      .select({
        id: entry.id,
        title: entry.title,
        type: entry.type,
        author: entry.author,
        userId: entry.userId,
        entryDate: entry.entryDate,
        bodyText: entry.bodyText,
        body: entry.body,
      })
      .from(entry)
      .where(and(eq(entry.id, context.articleId), isNull(entry.deletedAt)))
      .get();

    if (article) {
      const nameMap = await loadUserNameMap(db, [article.userId]);
      const authorName = resolveUserName(nameMap, article.userId, article.author);
      const raw = article.bodyText || toPlainText(article.body ?? "");
      const summary = raw.length > 2000 ? `${raw.slice(0, 2000)}…` : raw;
      blocks.push(
        `<current_article_context>
用户当前正在浏览以下空间文章：
- ID: ${article.id}
- 标题: ${article.title ?? "（无标题）"}
- 类型: ${article.type}
- 作者: ${authorName}
- 日期: ${article.entryDate ?? "未知"}
- 正文摘要:
${summary || "（无内容）"}

提示：若解答时需要阅读该文章的无截断完整全文，可调用 get_entry(id: "${article.id}")。
</current_article_context>`
      );
    }
  }

  return blocks.join("\n\n");
}
