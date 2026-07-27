import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { asc, eq } from "drizzle-orm";
import { aiConversation, feishuThreadSession } from "../db/schema.js";
import { generateId } from "../lib/id.js";
import { resolveModel, type AiRuntimeEnv } from "./ai-model.js";
import { createLogger } from "../lib/logger.js";
import { buildSystemPrompt as buildBaseSystemPrompt } from "./ai-prompt.js";
import { createAiTools } from "./ai-tools.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  createAiChatStore,
  compressMessagesForModel,
  generateAiId,
} from "./ai-chat-store.js";
import { generateHandoffSummary } from "./ai-compaction.js";
import { createLangfuseTrace, formatToolsForLangfuse } from "./langfuse.js";
import {
  addFeishuReaction,
  appendFeishuCardContent,
  createFeishuStreamingCard,
  finalizeFeishuStreamingCard,
  getTenantAccessToken,
  removeFeishuReaction,
  replyFeishuCardMessage,
  replyFeishuTextMessage,
} from "./feishu-api.js";

const log = createLogger("feishu-ai-chat");

/** CardKit 流推送：积算 N 字或 N ms 后批量 flush，减少 API 调用次数 */
const CARDKIT_MIN_CHUNK_LEN = 8;
const CARDKIT_FLUSH_INTERVAL_MS = 300;

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
 * 永久保持上下文连论性，除非用户主动发送 /clear 或 /reset 重置。
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

// ─── 工具调用日志 ─────────────────────────────────────────────────────────────

export interface ToolCallLog {
  toolName: string;
  toolDisplayName: string;
  args?: Record<string, any>;
  status: "executing" | "completed" | "failed";
  resultSummary?: string;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  search_entries: "🔍 空间记录检索",
  get_entry: "📖 读取条目全文",
  list_memos: "📋 浏览备忘录",
  web_search: "🌐 互联网全网搜索",
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

async function buildSystemPrompt(
  db: any,
  settingsMap?: Record<string, string>
): Promise<string> {
  const baseSystemPrompt = await buildBaseSystemPrompt(db, { mode: "global" }, settingsMap);
  const feishuNote = "\n\n提示：你正在通过飞书与用户对话。如果回复中包含站内链接，请直接给出完整 URL。";
  return `${baseSystemPrompt}${feishuNote}`;
}

// ─── CardKit 流式推送 ─────────────────────────────────────────────────────────

/**
 * 按 Markdown 行与字符限制将长文本拆分为多个 CardKit markdown 节点，防止单节点 4000 字符超限
 */
export function splitTextForCardElements(fullText: string, maxChunkLen = 3500): string[] {
  if (!fullText) return [""];
  if (fullText.length <= maxChunkLen) {
    return [fullText];
  }

  const chunks: string[] = [];
  let remaining = fullText;

  while (remaining.length > 0) {
    if (remaining.length <= maxChunkLen) {
      chunks.push(remaining);
      break;
    }

    let cutIndex = remaining.lastIndexOf("\n", maxChunkLen);
    if (cutIndex < maxChunkLen * 0.4) {
      cutIndex = remaining.lastIndexOf(" ", maxChunkLen);
      if (cutIndex < maxChunkLen * 0.4) {
        cutIndex = maxChunkLen;
      }
    }

    chunks.push(remaining.slice(0, cutIndex));
    remaining = remaining.slice(cutIndex);
  }

  return chunks;
}

/**
 * 管理单个 CardKit 消息卡片更新会话。
 * 保证所有追加与定型操作共享全局递增 sequence 序号，且按顺序串行发送。
 */
class CardKitSession {
  private sequence = 1;
  private queue = Promise.resolve();
  private lastSentMap = new Map<string, string>();
  private overflowText = "";

  constructor(
    private accessToken: string,
    public cardId: string,
    public toolElementId: string,
    public aiElementIds: string[]
  ) {}

  private enqueue<T>(task: (seq: number) => Promise<T>): Promise<T> {
    const currentSeq = this.sequence++;
    const res = this.queue
      .then(() => task(currentSeq))
      .catch((err) => {
        log.warn("feishu CardKit update failed", {
          cardId: this.cardId,
          seq: currentSeq,
          error: err instanceof Error ? err.message : String(err),
        });
      });
    this.queue = res.then(() => {});
    return res as Promise<T>;
  }

  async updateToolStatus(content: string): Promise<void> {
    if (this.lastSentMap.get(this.toolElementId) === content) return;
    this.lastSentMap.set(this.toolElementId, content);

    await this.enqueue((seq) =>
      appendFeishuCardContent(
        this.accessToken,
        this.cardId,
        this.toolElementId,
        content,
        seq
      )
    );
  }

  async updateAiContent(fullText: string): Promise<void> {
    const chunks = splitTextForCardElements(fullText, 3500);

    const maxElements = this.aiElementIds.length;
    const cardChunks = chunks.slice(0, maxElements);
    if (chunks.length > maxElements) {
      this.overflowText = chunks.slice(maxElements).join("");
    } else {
      this.overflowText = "";
    }

    for (let i = 0; i < cardChunks.length; i++) {
      const elementId = this.aiElementIds[i];
      const chunkText = cardChunks[i];

      if (this.lastSentMap.get(elementId) !== chunkText) {
        this.lastSentMap.set(elementId, chunkText);
        await this.enqueue((seq) =>
          appendFeishuCardContent(
            this.accessToken,
            this.cardId,
            elementId,
            chunkText,
            seq
          )
        );
      }
    }
  }

  async finalize(): Promise<{ overflowText: string }> {
    await this.enqueue((seq) =>
      finalizeFeishuStreamingCard(this.accessToken, this.cardId, seq)
    );
    return { overflowText: this.overflowText };
  }
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
    return;
  }

  // 表情状态转换
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

  // 解析 AI 模型与系统设置
  let resolvedModel: Awaited<ReturnType<typeof resolveModel>>;
  const settingsMap = await readSettingsMap(ctx.db);
  try {
    resolvedModel = await resolveModel(ctx.db, ctx.aiEnv);
  } catch (err) {
    log.error("failed to resolve AI model for feishu chat", err, { messageId: message.messageId });
    await replyFeishuTextMessage(accessToken, message.messageId, "AI 暂不可用，请检查模型配置 ⚙️", Boolean(message.replyInThread || message.threadId)).catch(() => {});
    return;
  }

  // 会话管理
  const conversationId = await resolveConversation(ctx.db, threadKey, actor);

  // 1. 上下文存储与读取（对齐 Web Chat 存储层）
  const store = createAiChatStore(ctx.db);
  let uiMessages = await store.listMessages(conversationId);

  const exists = uiMessages.some((m) => m.id === message.messageId);
  if (!exists) {
    await store.insertMessage({
      conversationId,
      role: "user",
      parts: [{ type: "text", text }],
      author: actor.name,
      id: message.messageId,
    });
    uiMessages = await store.listMessages(conversationId);
  }

  // 2. 上下文压缩与 Stage-3 摘要交接（对齐 Web Chat 上下文压缩算法）
  const { finalMessages, droppedTurns } = compressMessagesForModel(uiMessages);
  let effectiveMessages = finalMessages;

  if (droppedTurns.length > 0) {
    const summaryText = await generateHandoffSummary({
      model: resolvedModel.model,
      droppedTurns,
    });
    if (summaryText) {
      const bridgeMessage: UIMessage = {
        id: generateAiId("aimsg_bridge"),
        role: "user",
        parts: [
          {
            type: "text",
            text: `[系统上下文交接摘要 / Handoff Summary]\n因为对话较长，早期被截断的历史对话已被自动整理为以下 4 维摘要，请参考这些背景信息回答后续问题：\n\n${summaryText}`,
          },
        ],
      };
      effectiveMessages = [bridgeMessage, ...finalMessages];
    }
  }

  const modelMessages = await convertToModelMessages(effectiveMessages);

  // 3. 构建 System Prompt & 挂载动态工具（对齐 Web Chat 运行时 Agent 能力）
  const systemPrompt = await buildSystemPrompt(ctx.db, settingsMap);
  const tools = createAiTools(ctx.db, settingsMap, (ctx.aiEnv ?? process.env) as Record<string, string>);

  // 4. 可观测性追踪（对齐 Web Chat 的 Langfuse Trace 埋点）
  const trace = createLangfuseTrace({
    name: "feishu-chat",
    userId: actor.userId,
    sessionId: conversationId,
    metadata: {
      provider: resolvedModel.provider,
      modelId: resolvedModel.modelId,
      threadKey,
    },
    tags: ["feishu", resolvedModel.provider],
  }, ctx.aiEnv ?? {});

  const generation = trace?.generation({
    name: "streamText",
    model: resolvedModel.modelId,
    input: [
      { role: "system", content: systemPrompt },
      ...modelMessages,
    ],
  });

  log.info("invoking AI model stream for feishu chat", {
    conversationId,
    modelId: resolvedModel.modelId,
    provider: resolvedModel.provider,
    messageCount: modelMessages.length,
    messageId: message.messageId,
  });

  // 动态捕获 Tool 调用的日志并在卡片中展示
  const toolLogs: ToolCallLog[] = [];

  // 创建 CardKit 卡片会话
  let cardSession: CardKitSession | null = null;
  const shouldReplyInThread = Boolean(message.threadId || message.replyInThread);

  try {
    const { cardId, toolElementId, aiElementIds } = await createFeishuStreamingCard(accessToken);
    await replyFeishuCardMessage(accessToken, message.messageId, cardId, shouldReplyInThread);
    cardSession = new CardKitSession(accessToken, cardId, toolElementId, aiElementIds);
  } catch (err) {
    log.error("failed to create feishu CardKit streaming card, will fallback to text response", err, {
      messageId: message.messageId,
      conversationId,
    });
  }

  // 启动流式 AI Agent 调用
  const startedAt = Date.now();
  const streamResult = streamText({
    model: resolvedModel.model,
    system: systemPrompt,
    messages: modelMessages,
    tools,
    stopWhen: () => false,
    onStepFinish: async (step) => {
      if (step.toolCalls && step.toolCalls.length > 0) {
        for (const tc of step.toolCalls) {
          const res = step.toolResults?.find((tr) => tr.toolCallId === tc.toolCallId);
          toolLogs.push({
            toolName: tc.toolName,
            toolDisplayName: TOOL_DISPLAY_NAMES[tc.toolName] ?? `🛠️ ${tc.toolName}`,
            args: (tc as any).args as Record<string, any>,
            status: res ? "completed" : "executing",
            resultSummary: res ? JSON.stringify((res as any).result).slice(0, 200) : undefined,
          });
        }
        if (cardSession) {
          const formatted = formatToolCallLogs(toolLogs);
          if (formatted) {
            void cardSession.updateToolStatus(formatted);
          }
        }
      }
    },
    onFinish: async () => {
      log.info("feishu chat finished", {
        conversationId,
        provider: resolvedModel.provider,
        durationMs: Date.now() - startedAt,
      });
    },
    onError: ({ error }) => {
      generation?.end({ error });
      log.error("feishu chat stream error", { conversationId, error });
    },
  });

  // 读取 AI 流式输出并同步推送 CardKit
  let fullResponse = "";
  let buffer = "";
  let lastFlush = Date.now();

  try {
    for await (const chunk of streamResult.textStream) {
      fullResponse += chunk;
      buffer += chunk;
      if (cardSession) {
        const elapsed = Date.now() - lastFlush;
        if (
          buffer.length >= CARDKIT_MIN_CHUNK_LEN ||
          elapsed >= CARDKIT_FLUSH_INTERVAL_MS
        ) {
          void cardSession.updateAiContent(fullResponse);
          buffer = "";
          lastFlush = Date.now();
        }
      }
    }

    if (cardSession && buffer) {
      void cardSession.updateAiContent(fullResponse);
    }

    if (cardSession) {
      const { overflowText } = await cardSession.finalize();
      if (overflowText && overflowText.trim()) {
        log.info("feishu AI response exceeded card capacity, sending overflow text via follow-up replies", {
          conversationId,
          overflowLength: overflowText.length,
        });
        const overflowChunks = splitTextForCardElements(overflowText, 3500);
        for (const overflowChunk of overflowChunks) {
          if (overflowChunk.trim()) {
            await replyFeishuTextMessage(
              accessToken,
              message.messageId,
              overflowChunk,
              shouldReplyInThread
            ).catch((err) => log.error("failed to send feishu overflow message", err));
          }
        }
      }
    }
  } catch (streamErr) {
    log.error("AI text stream collection failed", streamErr, { conversationId });
    generation?.end({ error: streamErr });
  }

  if (fullResponse) {
    generation?.end({ output: fullResponse });
  }

  const usedCardKit = Boolean(cardSession);

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

  // 处理表情关联
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
  await store.insertMessage({
    conversationId,
    role: "assistant",
    parts: [{ type: "text", text: fullResponse }],
  });
}
