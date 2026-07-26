import { streamText } from "ai";
import { asc, eq } from "drizzle-orm";
import { aiConversation, aiMessage, feishuThreadSession } from "../db/schema.js";
import { generateId } from "../lib/id.js";
import { resolveModel, type AiRuntimeEnv } from "./ai-model.js";
import { searchEntriesForFeishu } from "./feishu-commands.js";
import {
  addFeishuReaction,
  appendFeishuCardContent,
  createFeishuStreamingCard,
  finalizeFeishuStreamingCard,
  getTenantAccessToken,
  replyFeishuCardMessage,
  replyFeishuTextMessage,
  sendFeishuCardMessage,
  sendFeishuTextMessage,
} from "./feishu-api.js";

/** 30 分钟 idle 后自动开启新会话 */
const IDLE_TIMEOUT_SECS = 30 * 60;

/** CardKit 流推送：积攒 N 字或 N ms 后批量 flush，减少 API 调用次数 */
const CARDKIT_MIN_CHUNK_LEN = 8;
const CARDKIT_FLUSH_INTERVAL_MS = 300;

/** 加载历史消息条数上限（控制上下文 token） */
const HISTORY_LIMIT = 20;

function nowSec(): number {
  return Math.floor(Date.now() / 1000);
}

// ─── 公开接口类型 ─────────────────────────────────────────────────────────────

export interface FeishuAiChatContext {
  db: any;
  appId: string;
  appSecret: string;
  baseUrl: string;
  aiEnv?: AiRuntimeEnv;
}

export interface FeishuAiChatActor {
  userId: string;
  name: string;
}

export interface FeishuAiChatMessage {
  messageId: string;
  chatId: string;
  /** Feishu thread_id；p2p 单聊无话题时为空字符串 */
  threadId: string;
}

// ─── 会话管理 ─────────────────────────────────────────────────────────────────

/**
 * 根据 threadKey 查找或创建 ai_conversation，并维护 idle TTL。
 * threadKey = thread_id（有话题时）或 chat_id（p2p 单聊）。
 */
async function resolveConversation(
  db: any,
  threadKey: string,
  actor: FeishuAiChatActor
): Promise<string> {
  const now = nowSec();
  const idleCutoff = now - IDLE_TIMEOUT_SECS;

  const existing = await db
    .select({
      conversationId: feishuThreadSession.conversationId,
      lastActiveAt: feishuThreadSession.lastActiveAt,
    })
    .from(feishuThreadSession)
    .where(eq(feishuThreadSession.threadKey, threadKey))
    .get();

  if (existing && existing.lastActiveAt >= idleCutoff) {
    // 仍在活跃窗口内 → 续用，更新 lastActiveAt
    await db
      .update(feishuThreadSession)
      .set({ lastActiveAt: now })
      .where(eq(feishuThreadSession.threadKey, threadKey));
    return existing.conversationId as string;
  }

  // 超时或首次 → 新建 ai_conversation
  const conversationId = generateId("conv");
  await db.insert(aiConversation).values({
    id: conversationId,
    title: "飞书对话",
    contextMode: "global",
    source: "feishu",
    userId: actor.userId,
    author: actor.name,
    shared: false,
    lastPreview: "",
    createdAt: now,
    updatedAt: now,
  });

  if (existing) {
    // 已有记录但超时 → 替换 conversationId
    await db
      .update(feishuThreadSession)
      .set({ conversationId, lastActiveAt: now })
      .where(eq(feishuThreadSession.threadKey, threadKey));
  } else {
    await db.insert(feishuThreadSession).values({
      threadKey,
      conversationId,
      userId: actor.userId,
      lastActiveAt: now,
      createdAt: now,
    });
  }

  return conversationId;
}

// ─── 历史消息 ─────────────────────────────────────────────────────────────────

interface HistoryMessage {
  role: "user" | "assistant";
  content: string;
}

async function loadHistory(
  db: any,
  conversationId: string
): Promise<HistoryMessage[]> {
  const rows = await db
    .select({ role: aiMessage.role, parts: aiMessage.parts })
    .from(aiMessage)
    .where(eq(aiMessage.conversationId, conversationId))
    .orderBy(asc(aiMessage.createdAt))
    .limit(HISTORY_LIMIT);

  return rows
    .filter(
      (r: { role: string; parts: string }) =>
        r.role === "user" || r.role === "assistant"
    )
    .map((r: { role: string; parts: string }) => {
      let text = "";
      try {
        const parts = JSON.parse(r.parts) as Array<{
          type: string;
          text?: string;
        }>;
        text = parts.find((p) => p.type === "text")?.text ?? "";
      } catch {
        text = r.parts;
      }
      return { role: r.role as "user" | "assistant", content: text };
    });
}

async function saveMessage(
  db: any,
  conversationId: string,
  role: "user" | "assistant",
  content: string,
  actor?: FeishuAiChatActor
): Promise<void> {
  await db.insert(aiMessage).values({
    id: generateId("msg"),
    conversationId,
    role,
    userId: role === "user" ? (actor?.userId ?? null) : null,
    author: role === "user" ? (actor?.name ?? null) : null,
    parts: JSON.stringify([{ type: "text", text: content }]),
    createdAt: nowSec(),
  });
}

// ─── System Prompt ────────────────────────────────────────────────────────────

async function buildSystemPrompt(
  db: any,
  baseUrl: string,
  query: string
): Promise<string> {
  let contextSection = "";
  try {
    const result = await searchEntriesForFeishu(db, query, baseUrl);
    if (
      !result.startsWith("未找到") &&
      !result.startsWith("请提供") &&
      result.trim()
    ) {
      contextSection = `\n\n以下是空间中与问题相关的记录（仅供参考，请勿编造）：\n${result}`;
    }
  } catch {
    // 搜索失败不影响对话
  }

  return `你是情侣空间 Orbit 的 AI 助手，通过飞书与用户对话。你能帮助他们查询和回顾记录、回答关于生活记录的问题。
请用温暖、简洁的中文回复。不要编造未出现的事实。如果不确定请直说。
如果回复中包含站内链接，请直接给出完整 URL。${contextSection}`;
}

// ─── CardKit 流式推送 ─────────────────────────────────────────────────────────

/**
 * 尝试通过 CardKit 流式推送 AI 回复。
 * 返回完整回复文本。如果 CardKit 初始化失败，抛出异常由调用方降级处理。
 */
async function streamToCardKit(
  accessToken: string,
  messageId: string,
  chatId: string,
  threadId: string,
  textStream: AsyncIterable<string>
): Promise<string> {
  // Phase 1: 创建并发送/回复占位卡片
  const { cardId, elementId } = await createFeishuStreamingCard(accessToken);
  
  if (threadId) {
    // 如果消息来自 Thread 话题，使用回复 API，带上 reply_in_thread: true！
    await replyFeishuCardMessage(accessToken, messageId, cardId, true);
  } else {
    // 普通单聊直接推送到 chat_id
    await sendFeishuCardMessage(accessToken, chatId, "chat_id", cardId);
  }

  // Phase 2: 流式 Append
  let fullText = "";
  let buffer = "";
  let lastFlush = Date.now();

  for await (const chunk of textStream) {
    fullText += chunk;
    buffer += chunk;
    const elapsed = Date.now() - lastFlush;
    if (
      buffer.length >= CARDKIT_MIN_CHUNK_LEN ||
      elapsed >= CARDKIT_FLUSH_INTERVAL_MS
    ) {
      // Append 失败静默忽略，继续流
      await appendFeishuCardContent(
        accessToken,
        cardId,
        elementId,
        buffer
      ).catch(() => {});
      buffer = "";
      lastFlush = Date.now();
    }
  }

  if (buffer) {
    await appendFeishuCardContent(
      accessToken,
      cardId,
      elementId,
      buffer
    ).catch(() => {});
  }

  // Phase 3: 定型
  await finalizeFeishuStreamingCard(accessToken, cardId).catch(() => {});

  return fullText;
}

// ─── 公开入口 ─────────────────────────────────────────────────────────────────

/**
 * 清空指定 threadKey 的 AI 会话（下次对话重新开始）。
 */
export async function clearFeishuAiSession(
  db: any,
  threadKey: string
): Promise<void> {
  await db
    .delete(feishuThreadSession)
    .where(eq(feishuThreadSession.threadKey, threadKey));
}

/**
 * 飞书 AI 多轮对话主入口。
 * 负责会话管理、上下文构建、流式推送和消息持久化。
 */
export async function handleFeishuAiChat(
  ctx: FeishuAiChatContext,
  message: FeishuAiChatMessage,
  text: string,
  actor: FeishuAiChatActor
): Promise<void> {
  const threadKey = message.threadId || message.chatId;

  // 获取 access token
  let accessToken: string;
  try {
    accessToken = await getTenantAccessToken(ctx.appId, ctx.appSecret);
  } catch {
    return; // 无法获取 token，静默失败
  }

  // 解析 AI 模型
  let resolvedModel: Awaited<ReturnType<typeof resolveModel>>;
  try {
    resolvedModel = await resolveModel(ctx.db, ctx.aiEnv);
  } catch (err) {
    if (message.threadId) {
      await replyFeishuTextMessage(accessToken, message.messageId, "AI 暂不可用，请检查模型配置 ⚙️", true).catch(() => {});
    } else {
      await sendFeishuTextMessage(accessToken, message.chatId, "chat_id", "AI 暂不可用，请检查模型配置 ⚙️").catch(() => {});
    }
    return;
  }

  // 会话管理
  const conversationId = await resolveConversation(ctx.db, threadKey, actor);

  // 加载历史 & 构建 system prompt（并行）
  const [history, systemPrompt] = await Promise.all([
    loadHistory(ctx.db, conversationId),
    buildSystemPrompt(ctx.db, ctx.baseUrl, text),
  ]);

  // 保存用户消息
  await saveMessage(ctx.db, conversationId, "user", text, actor);

  // 若是首条消息，用内容更新对话标题
  if (history.length === 0) {
    await ctx.db
      .update(aiConversation)
      .set({ title: text.slice(0, 50), updatedAt: nowSec() })
      .where(eq(aiConversation.id, conversationId));
  }

  // 启动流式 AI 调用
  const streamResult = streamText({
    model: resolvedModel.model,
    system: systemPrompt,
    messages: [
      ...history,
      { role: "user" as const, content: text },
    ],
  });

  // 尝试 CardKit 流式推送；失败则降级为纯文本
  let fullResponse = "";
  let usedCardKit = false;

  try {
    fullResponse = await streamToCardKit(
      accessToken,
      message.messageId,
      message.chatId,
      message.threadId,
      streamResult.textStream
    );
    usedCardKit = true;
  } catch (err) {
    console.error("[Feishu AI Chat] CardKit streaming failed, falling back to text:", err);
    // CardKit 初始化失败 → 收集全部文本后发纯文本消息
    try {
      for await (const chunk of streamResult.textStream) {
        fullResponse += chunk;
      }
    } catch {
      // 流本身也失败
    }
  }

  if (!usedCardKit && fullResponse) {
    if (message.threadId) {
      await replyFeishuTextMessage(accessToken, message.messageId, fullResponse, true).catch(() => {});
    } else {
      await sendFeishuTextMessage(accessToken, message.chatId, "chat_id", fullResponse).catch(() => {});
    }
  }

  if (!fullResponse) {
    if (message.threadId) {
      await replyFeishuTextMessage(accessToken, message.messageId, "AI 回复失败，请稍后再试 🔄", true).catch(() => {});
    } else {
      await sendFeishuTextMessage(accessToken, message.chatId, "chat_id", "AI 回复失败，请稍后再试 🔄").catch(() => {});
    }
    return;
  }

  // ⚡️ 核心体验升级：处理完成，给用户的原消息贴上 CHECK_MARK (✔️) 表情表示回复完毕！
  void addFeishuReaction(accessToken, message.messageId, "CHECK_MARK").catch(() => {});

  // 持久化 AI 回复 & 更新对话预览
  await saveMessage(ctx.db, conversationId, "assistant", fullResponse);
  await ctx.db
    .update(aiConversation)
    .set({
      lastPreview: fullResponse.slice(0, 100),
      updatedAt: nowSec(),
    })
    .where(eq(aiConversation.id, conversationId));
}


