import { streamText } from "ai";
import { asc, eq } from "drizzle-orm";
import { aiConversation, aiMessage, feishuThreadSession } from "../db/schema.js";
import { generateId } from "../lib/id.js";
import { resolveModel, type AiRuntimeEnv } from "./ai-model.js";
import { searchEntriesForFeishu } from "./feishu-commands.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("feishu-ai-chat");
import {
  addFeishuReaction,
  appendFeishuCardContent,
  createFeishuStreamingCard,
  finalizeFeishuStreamingCard,
  getTenantAccessToken,
  removeFeishuReaction,
  replyFeishuCardMessage,
  replyFeishuTextMessage,
  sendFeishuCardMessage,
  sendFeishuTextMessage,
} from "./feishu-api.js";

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
  chatType?: string;
  senderOpenId?: string;
  replyInThread?: boolean;
  isQueued?: boolean;
  typingReactionPromise?: Promise<string | null>;
}

// ─── 会话管理 ─────────────────────────────────────────────────────────────────

/**
 * 根据 threadKey 查找或创建 ai_conversation。
 * 永久保持上下文连贯性，除非用户主动发送 /clear 或 /reset 重置。
 */
async function resolveConversation(
  db: any,
  threadKey: string,
  actor: FeishuAiChatActor
): Promise<string> {
  const now = nowSec();

  const existing = await db
    .select({
      conversationId: feishuThreadSession.conversationId,
    })
    .from(feishuThreadSession)
    .where(eq(feishuThreadSession.threadKey, threadKey))
    .get();

  if (existing) {
    // 永久续用已有对话会话
    await db
      .update(feishuThreadSession)
      .set({ lastActiveAt: now })
      .where(eq(feishuThreadSession.threadKey, threadKey));
    log.info("reusing existing feishu AI conversation", {
      conversationId: existing.conversationId,
      threadKey,
      userId: actor.userId,
    });
    return existing.conversationId as string;
  }

  // 首次发起对话 → 新建 ai_conversation
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

  await db.insert(feishuThreadSession).values({
    threadKey,
    conversationId,
    userId: actor.userId,
    lastActiveAt: now,
    createdAt: now,
  });

  log.info("created new feishu AI conversation", {
    conversationId,
    threadKey,
    userId: actor.userId,
    author: actor.name,
  });

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

export interface ToolCallLog {
  toolName: string;
  toolDisplayName: string;
  args?: Record<string, any>;
  status: "executing" | "completed" | "failed";
  resultSummary?: string;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_space_entries: "🔍 空间记录检索",
  web_search: "🌐 互联网全网搜索",
  query_weather: "🌤️ 实时天气查询",
  calculate: "🧮 数值计算分析",
  fetch_calendar: "📅 纪念日与日程查询",
};

export function formatToolCallLogs(logs: ToolCallLog[]): string {
  if (logs.length === 0) return "";

  const lines = logs.map((log) => {
    const icon = log.status === "executing" ? "⚙️" : log.status === "completed" ? "✅" : "❌";
    const statusText = log.status === "executing" ? "正在执行..." : log.status === "completed" ? "已完成" : "执行失败";
    const name = TOOL_DISPLAY_NAMES[log.toolName] ?? `🛠️ ${log.toolName}`;
    let text = `${icon} **${name}** (${statusText})`;
    if (log.args && Object.keys(log.args).length > 0) {
      text += `\n> 📥 **参数:** \`${JSON.stringify(log.args)}\``;
    }
    if (log.resultSummary) {
      text += `\n> 📤 **结果:** ${log.resultSummary.slice(0, 200)}`;
    }
    return text;
  });

  return lines.join("\n\n") + "\n---";
}

interface SystemPromptResult {
  systemPrompt: string;
  toolStatusContent?: string;
  toolLogs?: ToolCallLog[];
}

async function buildSystemPrompt(
  db: any,
  baseUrl: string,
  query: string
): Promise<SystemPromptResult> {
  let contextSection = "";
  const toolLogs: ToolCallLog[] = [];

  try {
    const result = await searchEntriesForFeishu(db, query, baseUrl);
    if (
      !result.startsWith("未找到") &&
      !result.startsWith("请提供") &&
      result.trim()
    ) {
      contextSection = `\n\n以下是空间中与问题相关的记录（仅供参考，请勿编造）：\n${result}`;
      toolLogs.push({
        toolName: "search_space_entries",
        toolDisplayName: "🔍 空间记录检索",
        args: { query },
        status: "completed",
        resultSummary: result.slice(0, 200),
      });
    }
  } catch {
    // 搜索失败不影响对话
  }

  const systemPrompt = `你是情侣空间 Orbit 的 AI 助手，通过飞书与用户对话。你能帮助他们查询和回顾记录、回答关于生活记录的问题。
请用温暖、简洁的中文回复。不要编造未出现的事实。如果不确定请直说。
如果回复中包含站内链接，请直接给出完整 URL。${contextSection}`;

  return {
    systemPrompt,
    toolStatusContent: formatToolCallLogs(toolLogs),
    toolLogs,
  };
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
  replyInThread: boolean,
  textStream: AsyncIterable<string>,
  toolStatusContent?: string
): Promise<string> {
  // Phase 1: 创建卡片（包含 tool_status 与 ai_content 两个动态节点）并通过 Reply 接口引用回复卡片
  const { cardId, toolElementId, aiElementId } = await createFeishuStreamingCard(accessToken);
  const shouldReplyInThread = Boolean(threadId) || replyInThread;
  await replyFeishuCardMessage(accessToken, messageId, cardId, shouldReplyInThread);

  let sequence = 1;

  // ⚡️ 核心体验升级：若触发了搜索/工具调用，先将工具调用状态与检索来源呈现在卡片顶部！
  if (toolStatusContent) {
    await appendFeishuCardContent(
      accessToken,
      cardId,
      toolElementId,
      toolStatusContent,
      sequence++
    ).catch(() => {});
  }

  // Phase 2: 流式 Append AI 正文
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
      const currentSeq = sequence++;
      await appendFeishuCardContent(
        accessToken,
        cardId,
        aiElementId,
        fullText, // 传入全量累加文本！
        currentSeq
      ).catch(() => {});
      buffer = "";
      lastFlush = Date.now();
    }
  }

  if (buffer) {
    const currentSeq = sequence++;
    await appendFeishuCardContent(
      accessToken,
      cardId,
      aiElementId,
      fullText, // 传入全量累加文本！
      currentSeq
    ).catch(() => {});
  }

  // Phase 3: 定型（PATCH /settings 把 streaming_mode 置为 false，彻底消除 [生成中...] 提示）
  await finalizeFeishuStreamingCard(
    accessToken,
    cardId,
    sequence++
  ).catch(() => {});

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
  log.info("cleared feishu AI session", { threadKey });
}

/** 每个会话 (threadKey) 的消息处理排队 Map，保证同一会话并发消息按顺序串行执行 */
const threadQueueMap = new Map<string, Promise<void>>();

/** 查询当前会话是否有正在处理/排队中的任务 */
export function isThreadBusy(threadKey: string): boolean {
  return threadQueueMap.has(threadKey);
}

/**
 * 飞书 AI 多轮对话主入口（带并发排队锁）。
 */
export async function handleFeishuAiChat(
  ctx: FeishuAiChatContext,
  message: FeishuAiChatMessage,
  text: string,
  actor: FeishuAiChatActor
): Promise<void> {
  // 精准 Session 隔离逻辑：
  // 1. 在具体的 Thread 话题里 ➔ thread:${threadId} (话题独立 Session)
  // 2. 在群聊中 ➔ group:${chatId} (群聊使用 chatId)
  // 3. 用户单聊 ➔ p2p:${senderOpenId || actor.userId} (单聊使用各自的 open_id)
  let threadKey = "";
  if (message.threadId) {
    threadKey = `thread:${message.threadId}`;
  } else if (message.chatType === "group" || message.chatId.startsWith("oc_")) {
    threadKey = `group:${message.chatId}`;
  } else {
    const p2pId = message.senderOpenId || actor.userId;
    threadKey = `p2p:${p2pId}`;
  }

  const previousTask = threadQueueMap.get(threadKey) ?? Promise.resolve();

  const currentTask = previousTask
    .then(async () => {
      await processSingleAiChat(ctx, message, text, actor, threadKey);
    })
    .catch((err) => {
      console.error("[Feishu AI Chat] Concurrent task execution failed:", err);
    });

  threadQueueMap.set(threadKey, currentTask);

  void currentTask.finally(() => {
    if (threadQueueMap.get(threadKey) === currentTask) {
      threadQueueMap.delete(threadKey);
    }
  });

  await currentTask;
}

async function processSingleAiChat(
  ctx: FeishuAiChatContext,
  message: FeishuAiChatMessage,
  text: string,
  actor: FeishuAiChatActor,
  threadKey: string
): Promise<void> {
  // 获取 access token
  let accessToken: string;
  try {
    accessToken = await getTenantAccessToken(ctx.appId, ctx.appSecret);
  } catch (err) {
    log.error("failed to acquire feishu tenant access token", err, { messageId: message.messageId });
    return; // 无法获取 token，静默失败
  }

  // ⚡️ 表情状态转换：若该消息之前在排队（贴了 THINKING 表情），轮到它开始生成时，撤销 THINKING 并换贴 Typing 表情！
  let activeReactionPromise: Promise<string | null> | undefined = message.typingReactionPromise;
  if (message.isQueued) {
    activeReactionPromise = (async () => {
      const queuedReactionId = await message.typingReactionPromise;
      if (queuedReactionId) {
        await removeFeishuReaction(accessToken, message.messageId, queuedReactionId).catch(() => {});
      }
      return addFeishuReaction(accessToken, message.messageId, "Typing").catch(() => null);
    })();
  }

  // 解析 AI 模型
  let resolvedModel: Awaited<ReturnType<typeof resolveModel>>;
  try {
    resolvedModel = await resolveModel(ctx.db, ctx.aiEnv);
  } catch (err) {
    log.error("failed to resolve AI model for feishu chat", err, { messageId: message.messageId });
    await replyFeishuTextMessage(accessToken, message.messageId, "AI 暂不可用，请检查模型配置 ⚙️", Boolean(message.replyInThread || message.threadId)).catch(() => {});
    return;
  }

  // 会话管理
  const conversationId = await resolveConversation(ctx.db, threadKey, actor);

  // 加载历史 & 构建 system prompt（并行）
  const [history, promptRes] = await Promise.all([
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

  log.info("invoking AI model stream for feishu chat", {
    conversationId,
    modelId: resolvedModel.modelId,
    provider: resolvedModel.provider,
    historyCount: history.length,
    messageId: message.messageId,
  });

  // 启动流式 AI 调用
  const streamResult = streamText({
    model: resolvedModel.model,
    system: promptRes.systemPrompt,
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
      Boolean(message.replyInThread),
      streamResult.textStream,
      promptRes.toolStatusContent
    );
    usedCardKit = true;
  } catch (err) {
    log.error("CardKit streaming failed, falling back to text response", err, {
      messageId: message.messageId,
      conversationId,
    });
    // CardKit 初始化失败 → 收集全部文本后发纯文本消息
    try {
      for await (const chunk of streamResult.textStream) {
        fullResponse += chunk;
      }
    } catch (streamErr) {
      log.error("AI text stream collection failed", streamErr, { conversationId });
    }
  }

  if (!usedCardKit && fullResponse) {
    await replyFeishuTextMessage(accessToken, message.messageId, fullResponse, true).catch(() => {});
  }

  if (!fullResponse) {
    log.warn("feishu AI response empty or failed", { conversationId, messageId: message.messageId });
    await replyFeishuTextMessage(accessToken, message.messageId, "AI 回复失败，请稍后再试 🔄", true).catch(() => {});
    return;
  }

  log.info("feishu AI chat response complete", {
    conversationId,
    usedCardKit,
    fullResponseLength: fullResponse.length,
    responsePreview: fullResponse.slice(0, 60),
  });

  // ⚡️ 核心体验升级：处理完成，先撤销 Typing/THINKING 表情，再贴上绿色 DONE 表情！
  if (activeReactionPromise) {
    activeReactionPromise.then(async (reactionId) => {
      if (reactionId) {
        await removeFeishuReaction(accessToken, message.messageId, reactionId).catch(() => {});
      }
      await addFeishuReaction(accessToken, message.messageId, "DONE").catch(() => {});
    }).catch(() => {});
  } else {
    void addFeishuReaction(accessToken, message.messageId, "DONE").catch(() => {});
  }

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


