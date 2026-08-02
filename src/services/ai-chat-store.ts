import { and, desc, eq, isNull, or, sql } from "drizzle-orm";
import type { UIMessage } from "ai";
import { aiConversation, aiMessage } from "../db/schema.js";
import { extractVisibleTextFromParts } from "../lib/ai-message-content.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("ai-chat-store");

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
  const tail = messages.slice(-max);
  // Ensure the window never starts with an orphaned assistant message.
  // A tool-call / tool-result that lost its preceding user turn will
  // cause schema validation errors on OpenAI / Anthropic APIs.
  const safeStart = tail.findIndex((m) => m.role === "user");
  return safeStart > 0 ? tail.slice(safeStart) : tail;
}

// ---------------------------------------------------------------------------
// Stage-2: deterministic placeholder compression + token-budget windowing
// ---------------------------------------------------------------------------

/**
 * Rough chars-per-token estimate for mixed CJK / Latin content.
 * Avoids a hard tiktoken dependency; accurate enough for budget gating.
 */
const CHARS_PER_TOKEN = 3;

/**
 * Token budget for the messages array sent to the LLM.
 * Leaves ~4 k tokens for model output on a conservative 60 k context window.
 */
export const AI_CHAT_MESSAGE_TOKEN_BUDGET = 56_000;

/**
 * Number of most-recent user turns to keep verbatim (no elision).
 * Everything older is a candidate for placeholder compression.
 */
export const AI_CHAT_KEEP_RECENT_TURNS = 3;

/**
 * Serialised-result byte threshold.  Tool results smaller than this are kept
 * verbatim even in old turns (elision overhead would exceed the saving).
 */
const TOOL_RESULT_ELIDE_THRESHOLD = 500;

/** Narrow structural type for a tool-invocation part (avoids importing internals). */
interface ToolInvocationPart {
  type: "tool-invocation";
  toolInvocation: {
    toolCallId: string;
    toolName: string;
    args: unknown;
    state: "call" | "partial-call" | "result";
    result?: unknown;
  };
}

function isToolInvocationPart(part: unknown): part is ToolInvocationPart {
  if (typeof part !== "object" || part === null) return false;
  const p = part as Record<string, unknown>;
  return (
    p["type"] === "tool-invocation" &&
    typeof p["toolInvocation"] === "object" &&
    p["toolInvocation"] !== null
  );
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

function estimateMessageTokens(msg: UIMessage): number {
  // role tag + serialised parts content
  return (
    estimateTokens(msg.role) + estimateTokens(serializeParts(msg.parts))
  );
}

/**
 * Replace large tool-invocation results in a single assistant UIMessage with
 * a deterministic metadata placeholder.  Returns the original message
 * unchanged if no elision is needed (no allocation).
 */
function elideToolResultsInMessage(msg: UIMessage): UIMessage {
  if (msg.role !== "assistant") return msg;

  let modified = false;
  const newParts = (msg.parts as unknown[]).map((part) => {
    if (!isToolInvocationPart(part)) return part;
    if (part.toolInvocation.state !== "result") return part;

    const resultJson = JSON.stringify(part.toolInvocation.result ?? "");
    if (resultJson.length <= TOOL_RESULT_ELIDE_THRESHOLD) return part;

    modified = true;
    return {
      ...part,
      toolInvocation: {
        ...part.toolInvocation,
        result: `[已压缩: ${part.toolInvocation.toolName}, 原始 ${resultJson.length} 字节。如需完整内容请重新调用该工具。]`,
      },
    };
  });

  if (!modified) return msg;
  return { ...msg, parts: newParts as UIMessage["parts"] };
}

/**
 * Split a flat UIMessage array into turns.
 * A turn begins with a user message and includes all subsequent non-user
 * messages up to (but not including) the next user message.
 */
function splitIntoTurns(messages: UIMessage[]): UIMessage[][] {
  const turns: UIMessage[][] = [];
  let current: UIMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "user" && current.length > 0) {
      turns.push(current);
      current = [];
    }
    current.push(msg);
  }
  if (current.length > 0) turns.push(current);
  return turns;
}

/**
 * Stage-2 context compression.
 *
 * Processing order (Prune-before-Compact):
 * 1. Split history into turns anchored at each user message.
 * 2. Keep the most-recent AI_CHAT_KEEP_RECENT_TURNS turns verbatim.
 * 3. Elide large tool results in older turns (deterministic, zero LLM cost).
 * 4. Greedily fill the remaining token budget with compressed older turns,
 *    newest-first, dropping turns that no longer fit.
 *
 * This supersedes the simple trimMessagesForModel slice for normal use;
 * trimMessagesForModel is kept as a lightweight fallback.
 */
export interface CompressionResult {
  finalMessages: UIMessage[];
  droppedTurns: UIMessage[][];
}

/**
 * Stage-2 & Stage-3 context compression.
 *
 * Processing order (Prune-before-Compact):
 * 1. Split history into turns anchored at each user message.
 * 2. Keep the most-recent AI_CHAT_KEEP_RECENT_TURNS turns verbatim.
 * 3. Elide large tool results in older turns (deterministic, zero LLM cost).
 * 4. Greedily fill the remaining token budget with compressed older turns,
 *    newest-first, dropping turns that no longer fit.
 * 5. Returns dropped turns to allow Stage-3 LLM Handoff Compaction.
 */
export function compressMessagesForModel(
  messages: UIMessage[],
  budget = AI_CHAT_MESSAGE_TOKEN_BUDGET
): CompressionResult {
  if (messages.length === 0) {
    return { finalMessages: messages, droppedTurns: [] };
  }

  const turns = splitIntoTurns(messages);

  // If we have few turns, skip compression entirely.
  if (turns.length <= AI_CHAT_KEEP_RECENT_TURNS) {
    return { finalMessages: messages, droppedTurns: [] };
  }

  const recentTurns = turns.slice(-AI_CHAT_KEEP_RECENT_TURNS);
  const oldTurns = turns.slice(0, turns.length - AI_CHAT_KEEP_RECENT_TURNS);

  // Token cost of the verbatim recent tail.
  const recentTokens = recentTurns
    .flat()
    .reduce((sum, msg) => sum + estimateMessageTokens(msg), 0);

  let remainingBudget = budget - recentTokens;

  if (remainingBudget <= 0) {
    // Recent turns alone exceed the budget — return them with safety guard.
    const flat = recentTurns.flat();
    const safeStart = flat.findIndex((m) => m.role === "user");
    return {
      finalMessages: safeStart > 0 ? flat.slice(safeStart) : flat,
      droppedTurns: oldTurns,
    };
  }

  // Compress old turns: replace large tool results with metadata placeholders.
  const compressedOldTurns = oldTurns.map((turn) =>
    turn.map(elideToolResultsInMessage)
  );

  // Greedily include compressed old turns from newest to oldest.
  const selectedOldTurns: UIMessage[][] = [];
  const droppedOldTurns: UIMessage[][] = [];

  for (let i = compressedOldTurns.length - 1; i >= 0; i--) {
    const turn = compressedOldTurns[i]!;
    const cost = turn.reduce((s, m) => s + estimateMessageTokens(m), 0);
    if (cost <= remainingBudget) {
      selectedOldTurns.unshift(turn);
      remainingBudget -= cost;
    } else {
      // Preserve the original uncompressed old turn for the LLM summarizer
      droppedOldTurns.unshift(oldTurns[i]!);
    }
  }

  const flat = [...selectedOldTurns.flat(), ...recentTurns.flat()];
  // Final safety: ensure we never start with an orphaned assistant message.
  const safeStart = flat.findIndex((m) => m.role === "user");

  return {
    finalMessages: safeStart > 0 ? flat.slice(safeStart) : flat,
    droppedTurns: droppedOldTurns,
  };
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
    log.info("created AI conversation", {
      conversationId: record.id,
      userId: record.userId,
      author: record.author,
      title: record.title,
      contextMode: record.contextMode,
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
    log.info("created AI conversation with initial message", {
      conversationId,
      messageId: message.id,
      userId: conversation.userId,
      author: conversation.author,
      role: message.role,
      title: conversation.title,
      preview: preview.slice(0, 60),
    });

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
    log.info("soft deleted AI conversation", { conversationId: id });
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

  async function upsertMessage(input: {
    conversationId: string;
    role: UIMessage["role"];
    parts: UIMessage["parts"];
    author?: string | null;
    id?: string | null;
  }): Promise<AiMessageRow> {
    const validId = input.id?.trim() || null;
    const existing = validId
      ? ((await db
          .select()
          .from(aiMessage)
          .where(eq(aiMessage.id, validId))
          .get()) as AiMessageRow | undefined)
      : undefined;

    if (existing && validId) {
      const preview = partsToPreview(input.parts);
      await db
        .update(aiMessage)
        .set({
          parts: serializeParts(input.parts),
          author: input.author ?? existing.author,
        })
        .where(eq(aiMessage.id, validId));
      await db
        .update(aiConversation)
        .set({ lastPreview: preview, updatedAt: now() })
        .where(eq(aiConversation.id, input.conversationId));
      return {
        ...existing,
        parts: serializeParts(input.parts),
        author: input.author ?? existing.author,
      };
    }

    return insertMessage({ ...input, id: validId ?? undefined });
  }

  async function insertMessage(input: {
    conversationId: string;
    role: UIMessage["role"];
    parts: UIMessage["parts"];
    author?: string | null;
    id?: string;
  }): Promise<AiMessageRow> {
    const messageId = input.id?.trim() || generateAiId("aimsg");
    const row: AiMessageRow = {
      id: messageId,
      conversationId: input.conversationId,
      role: input.role,
      author: input.author ?? null,
      parts: serializeParts(input.parts),
      createdAt: now(),
    };
    const preview = partsToPreview(input.parts);

    await writeMessageAndTouchConversation(db, row, preview);
    log.info("inserted message into AI conversation", {
      conversationId: input.conversationId,
      messageId: row.id,
      role: input.role,
      author: input.author,
      preview: preview.slice(0, 60),
    });

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
    upsertMessage,
    buildConversationTitle,
  };
}

export type AiChatStore = ReturnType<typeof createAiChatStore>;
