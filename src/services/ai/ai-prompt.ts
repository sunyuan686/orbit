import { eq, and, isNull } from "drizzle-orm";
import { getSpaceAuthors } from "../space/space-authors.js";
import { loadUserNameMap, resolveUserName } from "../../lib/author-present.js";
import { entry } from "../../db/schema.js";
import { toPlainText } from "../../lib/plain-text.js";
import type { AiContextMode } from "./ai-chat-store.js";
import { beijingTodayKey } from "../../shared/index.js";
import {
  DEFAULT_AI_BOT_NAME,
  DEFAULT_AI_BOT_PERSONA,
  APP_SETTING_KEYS,
} from "../../app-settings.js";
import { readSettingsMap } from "../../db/settings-store.js";
import {
  buildChatAgentPrompt,
  buildArticleContextBlock,
} from "./prompts/index.js";

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

  let articleBlock: string | undefined;

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

      articleBlock = buildArticleContextBlock({
        id: article.id,
        title: article.title,
        type: article.type,
        authorName,
        entryDate: article.entryDate,
        summary,
      });
    }
  }

  return buildChatAgentPrompt({
    botName,
    botPersona,
    authorLabel,
    today,
    articleBlock,
  });
}
