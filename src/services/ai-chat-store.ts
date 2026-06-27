import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { aiConversation, aiMessage } from "../db/schema.js";

export type AiContextMode = "global" | "article";

export interface AiConversationRow {
  id: string;
  title: string;
  contextMode: AiContextMode;
  articleId: string | null;
  userId: string;
  author: string;
  shared: boolean;
  createdAt: number;
  updatedAt: number;
  deletedAt: number | null;
}

export interface AiMessageRow {
  id: string;
  conversationId: string;
  role: string;
  author: string | null;
  parts: string;
  createdAt: number;
}

export interface AiConversationListItem {
  id: string;
  title: string;
  contextMode: AiContextMode;
  articleId?: string;
  shared: boolean;
  isOwner: boolean;
  ownerAuthor: string;
  updatedAt: number;
  preview: string;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function generateAiId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `${prefix}_${suffix}`;
}

export function extractTextFromParts(parts: unknown): string {
  if (!Array.isArray(parts)) return "";
  return parts
    .filter((part): part is { type: string; text?: string } =>
      Boolean(part && typeof part === "object" && (part as { type?: string }).type === "text")
    )
    .map((part) => part.text ?? "")
    .join("");
}

export function partsToPreview(parts: unknown, maxLen = 80): string {
  const text = extractTextFromParts(parts).replace(/\s+/g, " ").trim();
  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}…`;
}

export function serializeParts(parts: UIMessage["parts"]): string {
  return JSON.stringify(parts);
}

export function parseParts(raw: string): UIMessage["parts"] {
  try {
    const parsed = JSON.parse(raw) as UIMessage["parts"];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function rowToUIMessage(row: AiMessageRow): UIMessage {
  const message: UIMessage = {
    id: row.id,
    role: row.role as UIMessage["role"],
    parts: parseParts(row.parts),
  };
  if (row.author) {
    (message as UIMessage & { metadata?: { author?: string } }).metadata = {
      author: row.author,
    };
  }
  return message;
}

export function createAiChatStore(db: any) {
  async function listConversations(
    currentUserId: string,
    opts?: { articleId?: string }
  ): Promise<AiConversationListItem[]> {
    const rows = (await db
      .select()
      .from(aiConversation)
      .where(
        and(
          isNull(aiConversation.deletedAt),
          or(
            eq(aiConversation.userId, currentUserId),
            and(
              eq(aiConversation.shared, true),
              sql`${aiConversation.userId} != ${currentUserId}`
            )
          ),
          opts?.articleId
            ? eq(aiConversation.articleId, opts.articleId)
            : undefined
        )
      )
      .orderBy(desc(aiConversation.updatedAt))) as AiConversationRow[];

    const items: AiConversationListItem[] = [];
    for (const row of rows) {
      const lastMessage = (await db
        .select()
        .from(aiMessage)
        .where(eq(aiMessage.conversationId, row.id))
        .orderBy(desc(aiMessage.createdAt))
        .limit(1)
        .get()) as AiMessageRow | undefined;

      items.push({
        id: row.id,
        title: row.title,
        contextMode: row.contextMode as AiContextMode,
        articleId: row.articleId ?? undefined,
        shared: row.shared,
        isOwner: row.userId === currentUserId,
        ownerAuthor: row.author,
        updatedAt: row.updatedAt,
        preview: lastMessage ? partsToPreview(parseParts(lastMessage.parts)) : "",
      });
    }
    return items;
  }

  async function getConversation(
    id: string
  ): Promise<AiConversationRow | null> {
    const row = (await db
      .select()
      .from(aiConversation)
      .where(and(eq(aiConversation.id, id), isNull(aiConversation.deletedAt)))
      .get()) as AiConversationRow | undefined;
    return row ?? null;
  }

  async function canAccessConversation(
    row: AiConversationRow,
    currentUserId: string
  ): Promise<boolean> {
    if (row.userId === currentUserId) return true;
    return row.shared;
  }

  async function createConversation(input: {
    userId: string;
    author: string;
    title: string;
    contextMode: AiContextMode;
    articleId?: string | null;
    shared?: boolean;
  }): Promise<AiConversationRow> {
    const timestamp = now();
    const id = generateAiId("aiconv");
    const record: AiConversationRow = {
      id,
      title: input.title,
      contextMode: input.contextMode,
      articleId: input.articleId ?? null,
      userId: input.userId,
      author: input.author,
      shared: input.shared ?? false,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    await db.insert(aiConversation).values({
      id: record.id,
      title: record.title,
      contextMode: record.contextMode,
      articleId: record.articleId,
      userId: record.userId,
      author: record.author,
      shared: record.shared,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: null,
    });
    return record;
  }

  async function updateConversation(
    id: string,
    patch: Partial<Pick<AiConversationRow, "title" | "shared" | "updatedAt">>
  ): Promise<void> {
    await db
      .update(aiConversation)
      .set({ ...patch, updatedAt: patch.updatedAt ?? now() })
      .where(eq(aiConversation.id, id));
  }

  async function softDeleteConversation(id: string): Promise<void> {
    await db
      .update(aiConversation)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(eq(aiConversation.id, id));
  }

  async function listMessages(conversationId: string): Promise<UIMessage[]> {
    const rows = (await db
      .select()
      .from(aiMessage)
      .where(eq(aiMessage.conversationId, conversationId))
      .orderBy(aiMessage.createdAt)) as AiMessageRow[];
    return rows.map(rowToUIMessage);
  }

  async function insertMessage(input: {
    conversationId: string;
    role: UIMessage["role"];
    parts: UIMessage["parts"];
    author?: string | null;
    id?: string;
  }): Promise<AiMessageRow> {
    const row: AiMessageRow = {
      id: input.id ?? generateAiId("aimsg"),
      conversationId: input.conversationId,
      role: input.role,
      author: input.author ?? null,
      parts: serializeParts(input.parts),
      createdAt: now(),
    };
    await db.insert(aiMessage).values(row);
    await updateConversation(input.conversationId, { updatedAt: row.createdAt });
    return row;
  }

  function buildConversationTitle(text: string): string {
    const trimmed = text.replace(/\s+/g, " ").trim();
    if (trimmed) {
      return trimmed.length > 30 ? `${trimmed.slice(0, 30)}…` : trimmed;
    }
    const d = new Date();
    const mm = String(d.getMonth() + 1).padStart(2, "0");
    const dd = String(d.getDate()).padStart(2, "0");
    return `新对话 · ${mm}-${dd}`;
  }

  return {
    listConversations,
    getConversation,
    canAccessConversation,
    createConversation,
    updateConversation,
    softDeleteConversation,
    listMessages,
    insertMessage,
    buildConversationTitle,
  };
}

export type AiChatStore = ReturnType<typeof createAiChatStore>;
