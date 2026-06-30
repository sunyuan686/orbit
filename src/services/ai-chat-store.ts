import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { aiConversation, aiMessage } from "../db/schema.js";
import { extractVisibleTextFromParts } from "../lib/ai-message-content.js";

export type AiContextMode = "global" | "article";

/** Max messages sent to the LLM per request (recent tail only). */
export const AI_CHAT_MAX_MODEL_MESSAGES = 40;

export interface AiConversationRow {
  id: string;
  title: string;
  contextMode: AiContextMode;
  articleId: string | null;
  userId: string;
  author: string;
  shared: boolean;
  lastPreview: string;
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
  const text = extractVisibleTextFromParts(parts).replace(/\s+/g, " ").trim();
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

export function trimMessagesForModel(
  messages: UIMessage[],
  max = AI_CHAT_MAX_MODEL_MESSAGES
): UIMessage[] {
  if (messages.length <= max) return messages;
  return messages.slice(-max);
}

async function writeMessageAndTouchConversation(
  db: any,
  row: AiMessageRow,
  preview: string
): Promise<void> {
  const patch = {
    updatedAt: row.createdAt,
    lastPreview: preview,
  };
  const where = eq(aiConversation.id, row.conversationId);

  if (typeof db.batch === "function") {
    await db.batch([
      db.insert(aiMessage).values(row),
      db.update(aiConversation).set(patch).where(where),
    ]);
    return;
  }

  await db.insert(aiMessage).values(row);
  await db.update(aiConversation).set(patch).where(where);
}

async function writeConversationWithMessage(
  db: any,
  conversation: AiConversationRow,
  message: AiMessageRow
): Promise<void> {
  const convValues = {
    id: conversation.id,
    title: conversation.title,
    contextMode: conversation.contextMode,
    articleId: conversation.articleId,
    userId: conversation.userId,
    author: conversation.author,
    shared: conversation.shared,
    lastPreview: conversation.lastPreview,
    createdAt: conversation.createdAt,
    updatedAt: conversation.updatedAt,
    deletedAt: null,
  };

  if (typeof db.batch === "function") {
    await db.batch([
      db.insert(aiConversation).values(convValues),
      db.insert(aiMessage).values(message),
    ]);
    return;
  }

  await db.insert(aiConversation).values(convValues);
  await db.insert(aiMessage).values(message);
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

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      contextMode: row.contextMode as AiContextMode,
      articleId: row.articleId ?? undefined,
      shared: row.shared,
      isOwner: row.userId === currentUserId,
      ownerAuthor: row.author,
      updatedAt: row.updatedAt,
      preview: row.lastPreview,
    }));
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
      lastPreview: "",
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
      lastPreview: record.lastPreview,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: null,
    });
    return record;
  }

  async function createConversationWithMessage(input: {
    userId: string;
    author: string;
    title: string;
    contextMode: AiContextMode;
    articleId?: string | null;
    shared?: boolean;
    message: {
      role: UIMessage["role"];
      parts: UIMessage["parts"];
      author?: string | null;
      id?: string;
    };
  }): Promise<{ conversation: AiConversationRow; message: AiMessageRow }> {
    const timestamp = now();
    const conversationId = generateAiId("aiconv");
    const preview = partsToPreview(input.message.parts);
    const conversation: AiConversationRow = {
      id: conversationId,
      title: input.title,
      contextMode: input.contextMode,
      articleId: input.articleId ?? null,
      userId: input.userId,
      author: input.author,
      shared: input.shared ?? false,
      lastPreview: preview,
      createdAt: timestamp,
      updatedAt: timestamp,
      deletedAt: null,
    };
    const message: AiMessageRow = {
      id: input.message.id ?? generateAiId("aimsg"),
      conversationId,
      role: input.message.role,
      author: input.message.author ?? null,
      parts: serializeParts(input.message.parts),
      createdAt: timestamp,
    };

    await writeConversationWithMessage(db, conversation, message);

    return { conversation, message };
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
    const preview = partsToPreview(input.parts);

    await writeMessageAndTouchConversation(db, row, preview);

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
    createConversationWithMessage,
    updateConversation,
    softDeleteConversation,
    listMessages,
    insertMessage,
    buildConversationTitle,
  };
}

export type AiChatStore = ReturnType<typeof createAiChatStore>;
