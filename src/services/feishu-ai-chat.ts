import { eq } from "drizzle-orm";
import {
  readUIMessageStream,
  isToolUIPart,
  type UIMessage,
} from "ai";
import { aiConversation, feishuThreadSession } from "../db/schema.js";
import { generateId } from "../lib/id.js";
import { type AiRuntimeEnv } from "./ai-model.js";
import { createLogger } from "../lib/logger.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  createAiChatStore,
  extractTextFromParts,
  generateAiId,
} from "./ai-chat-store.js";
import {
  findPendingWriteContentApprovals,
  buildWriteContentResultCard,
  formatWriteContentApprovalSummary,
  formatWriteContentErrorMessage,
  formatWriteContentSuccessMessage,
  isApprovalContinuation,
  parseFeishuTextApprovalDecision,
  rejectAllPendingWriteContentApprovals,
  type WriteContentToolOutcome,
} from "./ai-tool-approval.js";
import {
  completeWriteContentApproval,
} from "./write-content-approval-completion.js";
import {
  attachAgentLangfuseRecorder,
  beginAiChatTrace,
  finalizeAiChatTrace,
  prepareAiChatAgent,
  streamAiChat,
} from "./ai-chat-runtime.js";
import {
  enrichFeishuGroupMessagesForModel,
  stripFeishuSpeakerPrefix,
} from "./feishu-message-content.js";
import { normalizeFeishuAiResponseTimeoutMs } from "./feishu-settings.js";
import {
  addFeishuReaction,
  appendFeishuCardContent,
  createFeishuCardJson,
  createFeishuStreamingCard,
  finalizeFeishuStreamingCard,
  getTenantAccessToken,
  removeFeishuReaction,
  replyFeishuCardMessage,
  replyFeishuTextMessage,
} from "./feishu-api.js";

const log = createLogger("feishu-ai-chat");

/** CardKit 流推送：积算 N 字或 N ms 后批量 flush，降低请求频率 */
const CARDKIT_MIN_CHUNK_LEN = 60;
const CARDKIT_FLUSH_INTERVAL_MS = 1200;
/** 单次 Worker 执行中，CardKit 子请求调用次数上限，防止触发 Cloudflare 50 次子请求配额限制 */
const CARDKIT_MAX_SUBREQUESTS = 35;

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
  /** 无完整响应时的静默超时（毫秒），默认 3 分钟 */
  aiResponseTimeoutMs?: number;
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
  write_content: "✍️ 写入空间内容",
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

const FEISHU_SYSTEM_PROMPT_SUFFIX =
  "\n\n提示：你正在通过飞书与用户对话。如果回复中包含站内链接，请直接给出完整 URL。需要写入空间内容时直接调用 write_content，不要用文字向用户索要确认（飞书会自动弹出确认卡片）。写入成功后给出完整 URL；用户取消写入时告知已取消。";

const FEISHU_PENDING_WRITE_APPROVAL_NOTE =
  "请在下方卡片中点击「确认写入」或「取消」。";

const FEISHU_GROUP_SYSTEM_PROMPT_SUFFIX =
  "\n\n提示：当前为群聊，多条用户消息可能来自不同成员。每条用户消息以「姓名:」开头标识说话人，请根据该前缀区分是谁在说话。";

const FEISHU_P2P_SYSTEM_PROMPT_SUFFIX =
  "\n\n提示：当前为飞书单聊，你正在与「{name}」单独对话。请用「你」称呼对方，不要同时对空间两位成员使用「你们」或向两人一并打招呼；除非对方明确问起另一位成员。";

function buildFeishuPromptSuffix(
  chatType: string | undefined,
  actorName: string
): string {
  if (chatType === "group") {
    return `${FEISHU_SYSTEM_PROMPT_SUFFIX}${FEISHU_GROUP_SYSTEM_PROMPT_SUFFIX}`;
  }
  const name = actorName.trim() || "用户";
  return `${FEISHU_SYSTEM_PROMPT_SUFFIX}${FEISHU_P2P_SYSTEM_PROMPT_SUFFIX.replace("{name}", name)}`;
}

const FEISHU_AI_TIMEOUT_CARD_MESSAGE =
  "⏱️ **响应超时**\n\n已自动结束本次处理，你可以继续发送新消息。\n\n发送 **/reset** 可清空对话重新开始。";

class FeishuAiTimeoutError extends Error {
  constructor() {
    super("feishu ai response timeout");
    this.name = "FeishuAiTimeoutError";
  }
}

export function isFeishuChatResetCommand(text: string): boolean {
  const trimmed = stripFeishuSpeakerPrefix(text).trim();
  if (!trimmed) return false;
  const lower = trimmed.toLowerCase();
  return (
    lower === "/clear" ||
    lower === "/reset" ||
    trimmed === "重新开始" ||
    trimmed === "新对话" ||
    trimmed === "结束对话"
  );
}

async function finalizeFeishuCardWithError(
  cardSession: CardKitSession | null,
  message: string
): Promise<void> {
  if (!cardSession) return;
  try {
    await cardSession.finalize(message);
  } catch (err) {
    log.warn("failed to finalize feishu card after error", {
      cardId: cardSession.cardId,
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

async function markFeishuTypingDone(
  accessToken: string,
  messageId: string,
  activeReactionPromise?: Promise<string | null>
): Promise<void> {
  if (activeReactionPromise) {
    await activeReactionPromise
      .then(async (reactionId) => {
        if (reactionId) {
          await removeFeishuReaction(accessToken, messageId, reactionId).catch(() => {});
        }
        await addFeishuReaction(accessToken, messageId, "DONE").catch(() => {});
      })
      .catch(() => {});
    return;
  }
  await addFeishuReaction(accessToken, messageId, "DONE").catch(() => {});
}

async function silentlyFinalizeFeishuTimeout(options: {
  cardSession: CardKitSession | null;
  handles: ReturnType<typeof beginAiChatTrace>;
  accessToken: string;
  message: FeishuAiChatMessage;
  conversationId: string;
  timeoutMs: number;
  activeReactionPromise?: Promise<string | null>;
}): Promise<void> {
  log.warn("feishu AI chat timed out, finalizing card silently", {
    conversationId: options.conversationId,
    messageId: options.message.messageId,
    timeoutMs: options.timeoutMs,
  });
  if (options.cardSession) {
    await finalizeFeishuCardWithError(
      options.cardSession,
      FEISHU_AI_TIMEOUT_CARD_MESSAGE
    );
  }
  await finalizeAiChatTrace(options.handles, {
    error: new FeishuAiTimeoutError(),
  });
  await markFeishuTypingDone(
    options.accessToken,
    options.message.messageId,
    options.activeReactionPromise
  );
}

function raceFeishuAgentTurn(
  options: Parameters<typeof runFeishuAgentTurn>[0],
  abortController: AbortController,
  timeoutMs: number
): ReturnType<typeof runFeishuAgentTurn> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      abortController.abort();
      reject(new FeishuAiTimeoutError());
    }, timeoutMs);

    runFeishuAgentTurn(options)
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

function buildApprovalCallbackButton(
  label: string,
  type: "primary" | "default",
  approved: boolean,
  baseValue: Record<string, string>
): Record<string, unknown> {
  return {
    tag: "button",
    text: { tag: "plain_text", content: label },
    type,
    behaviors: [
      {
        type: "callback",
        value: {
          action: "orbit:ai_write_approval",
          approved,
          ...baseValue,
        },
      },
    ],
  };
}

function buildWriteContentApprovalCard(
  conversationId: string,
  approvalId: string,
  summary: string,
  replyMessageId: string
): Record<string, unknown> {
  const baseValue = {
    conversationId,
    approvalId,
    replyMessageId,
  };

  return {
    schema: "2.0",
    header: {
      title: { tag: "plain_text", content: "确认写入空间内容" },
      subtitle: { tag: "plain_text", content: "请审阅摘要后点击确认" },
      template: "orange",
    },
    body: {
      elements: [
        {
          tag: "markdown",
          content: summary,
        },
        buildApprovalCallbackButton("确认写入", "primary", true, baseValue),
        buildApprovalCallbackButton("取消", "default", false, baseValue),
      ],
    },
  };
}

async function sendWriteContentApprovalCard(
  accessToken: string,
  messageId: string,
  conversationId: string,
  approvalId: string,
  summary: string,
  replyInThread: boolean
): Promise<void> {
  const cardJson = buildWriteContentApprovalCard(
    conversationId,
    approvalId,
    summary,
    messageId
  );
  try {
    const cardId = await createFeishuCardJson(accessToken, cardJson);
    await replyFeishuCardMessage(accessToken, messageId, cardId, replyInThread);
  } catch (err) {
    log.error("failed to send feishu write approval card", err, {
      conversationId,
      approvalId,
      messageId,
    });
    throw err;
  }
}

async function sendWriteContentResultCard(
  accessToken: string,
  messageId: string,
  baseUrl: string,
  outcome: WriteContentToolOutcome,
  replyInThread: boolean
): Promise<void> {
  const cardJson = buildWriteContentResultCard(baseUrl, outcome);
  try {
    const cardId = await createFeishuCardJson(accessToken, cardJson);
    await replyFeishuCardMessage(accessToken, messageId, cardId, replyInThread);
  } catch (err) {
    log.error("failed to send feishu write result card", err, {
      messageId,
      contentId: outcome.id,
      contentType: outcome.type,
    });
    const fallback =
      formatWriteContentSuccessMessage(baseUrl, [outcome]) ??
      formatWriteContentErrorMessage([outcome]) ??
      (outcome.ok ? "✅ 写入成功" : "❌ 写入失败，请稍后再试");
    await replyFeishuTextMessage(
      accessToken,
      messageId,
      fallback,
      replyInThread
    );
  }
}

interface FeishuAgentStreamResult {
  assistantMessage: UIMessage;
  fullResponse: string;
  toolLogs: ToolCallLog[];
}

async function collectFeishuAgentStream(options: {
  streamResult: ReturnType<typeof streamAiChat>;
  uiMessages: UIMessage[];
  cardSession: CardKitSession | null;
  toolLogs: ToolCallLog[];
  abortSignal?: AbortSignal;
}): Promise<FeishuAgentStreamResult> {
  const uiStream = options.streamResult.toUIMessageStream({
    originalMessages: options.uiMessages,
    generateMessageId: () => generateAiId("aimsg"),
    onError: (error) => {
      log.error("feishu ui message stream error", error);
      return error instanceof Error ? error.message : String(error);
    },
  });

  let assistantMessage: UIMessage = {
    id: generateAiId("aimsg"),
    role: "assistant",
    parts: [],
  };
  let lastText = "";
  let lastFlush = Date.now();

  for await (const message of readUIMessageStream({
    stream: uiStream,
  })) {
    if (options.abortSignal?.aborted) {
      break;
    }
    assistantMessage = message;
    const fullResponse = extractTextFromParts(message.parts);
    if (fullResponse !== lastText && options.cardSession) {
      const elapsed = Date.now() - lastFlush;
      if (
        fullResponse.length - lastText.length >= CARDKIT_MIN_CHUNK_LEN ||
        elapsed >= CARDKIT_FLUSH_INTERVAL_MS
      ) {
        void options.cardSession.updateAiContent(fullResponse);
        lastText = fullResponse;
        lastFlush = Date.now();
      }
    }
  }

  const fullResponse = extractTextFromParts(assistantMessage.parts);
  if (options.cardSession && fullResponse !== lastText) {
    await options.cardSession.updateAiContent(fullResponse, true);
  }

  return {
    assistantMessage,
    fullResponse,
    toolLogs: options.toolLogs,
  };
}

async function runFeishuAgentTurn(options: {
  ctx: FeishuAiChatContext;
  message: FeishuAiChatMessage;
  actor: FeishuAiChatActor;
  threadKey: string;
  conversationId: string;
  uiMessages: UIMessage[];
  accessToken: string;
  cardSession: CardKitSession | null;
  handles: ReturnType<typeof beginAiChatTrace>;
  abortSignal?: AbortSignal;
}): Promise<{
  assistantMessage: UIMessage;
  fullResponse: string;
  pendingApproval: ReturnType<typeof findPendingWriteContentApprovals>[number] | null;
}> {
  const store = createAiChatStore(options.ctx.db);
  const settingsMap = await readSettingsMap(options.ctx.db);
  const modelMessages = enrichFeishuGroupMessagesForModel(
    options.uiMessages,
    options.message.chatType
  );
  const promptSuffix = buildFeishuPromptSuffix(
    options.message.chatType,
    options.actor.name
  );
  const agent = await prepareAiChatAgent({
    db: options.ctx.db,
    env: options.ctx.aiEnv,
    uiMessages: modelMessages,
    promptContext: { mode: "global" },
    promptSuffix,
    settingsMap,
    actor: {
      userId: options.actor.userId,
      author: options.actor.name,
    },
    trace: options.handles.trace,
  });

  attachAgentLangfuseRecorder(options.handles, {
    modelId: agent.modelId,
    provider: agent.provider,
    system: agent.system,
    tools: agent.tools,
    initialMessages: agent.modelMessages,
  });
  options.handles.trace?.updateTrace({
    metadata: {
      provider: agent.provider,
      modelId: agent.modelId,
      threadKey: options.threadKey,
    },
    tags: ["feishu", agent.provider],
  });

  const toolLogs: ToolCallLog[] = [];
  const streamResult = streamAiChat({
    model: agent.model,
    system: agent.system,
    messages: agent.modelMessages,
    tools: agent.tools,
    conversationId: options.conversationId,
    provider: agent.provider,
    modelId: agent.modelId,
    env: options.ctx.aiEnv,
    log,
    trace: options.handles.trace,
    agentRecorder: options.handles.agentRecorder ?? undefined,
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
        if (options.cardSession) {
          const formatted = formatToolCallLogs(toolLogs);
          if (formatted) {
            void options.cardSession.updateToolStatus(formatted);
          }
        }
      }
    },
    onError: ({ error }) => {
      log.error("feishu chat stream error", error, {
        conversationId: options.conversationId,
      });
      void finalizeAiChatTrace(options.handles, { error }).catch(() => {});
    },
    abortSignal: options.abortSignal,
  });

  const { assistantMessage, fullResponse } = await collectFeishuAgentStream({
    streamResult,
    uiMessages: options.uiMessages,
    cardSession: options.cardSession,
    toolLogs,
    abortSignal: options.abortSignal,
  });

  if (options.abortSignal?.aborted) {
    return {
      assistantMessage,
      fullResponse: "",
      pendingApproval: null,
    };
  }

  await store.upsertMessage({
    conversationId: options.conversationId,
    role: "assistant",
    parts: assistantMessage.parts,
    id: assistantMessage.id,
  });

  const pendingApprovals = findPendingWriteContentApprovals(assistantMessage);
  return {
    assistantMessage,
    fullResponse,
    pendingApproval: pendingApprovals[0] ?? null,
  };
}

async function finalizeFeishuChatResponse(options: {
  accessToken: string;
  message: FeishuAiChatMessage;
  cardSession: CardKitSession | null;
  fullResponse: string;
  conversationId: string;
  handles: ReturnType<typeof beginAiChatTrace>;
  activeReactionPromise?: Promise<string | null>;
}): Promise<void> {
  await finalizeAiChatTrace(options.handles, {
    output: options.fullResponse || undefined,
  });

  const shouldReplyInThread = Boolean(options.message.threadId || options.message.replyInThread);
  const usedCardKit = Boolean(options.cardSession);

  if (options.cardSession) {
    const { overflowText } = await options.cardSession.finalize(options.fullResponse);
    if (overflowText && overflowText.trim()) {
      const overflowChunks = splitTextForCardElements(overflowText, 3500);
      for (const overflowChunk of overflowChunks) {
        if (overflowChunk.trim()) {
          await replyFeishuTextMessage(
            options.accessToken,
            options.message.messageId,
            overflowChunk,
            shouldReplyInThread
          ).catch((err) => log.error("failed to send feishu overflow message", err));
        }
      }
    }
  }

  if (!usedCardKit && options.fullResponse) {
    await replyFeishuTextMessage(
      options.accessToken,
      options.message.messageId,
      options.fullResponse,
      shouldReplyInThread
    ).catch(() => {});
  }

  if (!options.fullResponse) {
    log.warn("feishu AI response empty or failed", {
      conversationId: options.conversationId,
      messageId: options.message.messageId,
      replyInThread: shouldReplyInThread,
      threadId: options.message.threadId ?? "",
    });
    const errorText =
      "AI 回复失败，请稍后再试 🔄\n\n发送 **/reset** 或 **重新开始** 可清空当前对话。";
    if (options.cardSession) {
      await finalizeFeishuCardWithError(options.cardSession, errorText);
    } else {
      await replyFeishuTextMessage(
        options.accessToken,
        options.message.messageId,
        errorText,
        shouldReplyInThread
      ).catch(() => {});
    }
    await markFeishuTypingDone(
      options.accessToken,
      options.message.messageId,
      options.activeReactionPromise
    );
    return;
  }

  await markFeishuTypingDone(
    options.accessToken,
    options.message.messageId,
    options.activeReactionPromise
  );
}

export async function resumeFeishuAiChatAfterApproval(
  ctx: FeishuAiChatContext,
  input: {
    conversationId: string;
    approvalId: string;
    approved: boolean;
    actor: FeishuAiChatActor;
    replyMessageId: string;
    replyInThread?: boolean;
  }
): Promise<void> {
  const accessToken = await getTenantAccessToken(ctx.appId, ctx.appSecret);
  const store = createAiChatStore(ctx.db);
  const storedMessages = await store.listMessages(input.conversationId);

  const handles = beginAiChatTrace({
    name: "feishu-chat-approval",
    userId: input.actor.userId,
    sessionId: input.conversationId,
    input: input.approved ? "tool-approval-approved" : "tool-approval-denied",
    metadata: { approvalId: input.approvalId },
    tags: ["feishu", "approval"],
    env: ctx.aiEnv ?? {},
  });

  const replyInThread = Boolean(input.replyInThread);

  try {
    const completion = await completeWriteContentApproval({
      db: ctx.db,
      storedMessages,
      approvalId: input.approvalId,
      approved: input.approved,
      actor: { userId: input.actor.userId, author: input.actor.name },
      baseUrl: ctx.baseUrl,
      approvalReasonApproved: "用户已在飞书确认写入",
      approvalReasonDenied: "用户已在飞书取消写入",
    });

    if (completion.assistantMessage) {
      await store.upsertMessage({
        id: completion.assistantMessage.id,
        conversationId: input.conversationId,
        role: "assistant",
        parts: completion.assistantMessage.parts,
      });
    }

    if (completion.status === "cancelled") {
      await finalizeAiChatTrace(handles, { output: "write-cancelled" });
      await replyFeishuTextMessage(
        accessToken,
        input.replyMessageId,
        completion.feedbackText,
        replyInThread
      ).catch(() => {});
      return;
    }

    if (completion.status === "missing-tool") {
      log.error("feishu approval resume missing approved tool part", undefined, {
        conversationId: input.conversationId,
        approvalId: input.approvalId,
      });
      await finalizeAiChatTrace(handles, {
        output: "write-approval-missing-tool",
      });
      await replyFeishuTextMessage(
        accessToken,
        input.replyMessageId,
        completion.feedbackText,
        replyInThread
      ).catch(() => {});
      return;
    }

    log.info("feishu write approval executed", {
      conversationId: input.conversationId,
      approvalId: input.approvalId,
      ok: completion.outcome?.ok,
      contentId: completion.outcome?.id,
      contentType: completion.outcome?.type,
    });

    await finalizeAiChatTrace(handles, {
      output: completion.feedbackText || completion.outcome,
    });
    await sendWriteContentResultCard(
      accessToken,
      input.replyMessageId,
      ctx.baseUrl,
      completion.outcome!,
      replyInThread
    );
  } catch (err) {
    log.error("feishu approval resume failed", err, {
      conversationId: input.conversationId,
      approvalId: input.approvalId,
    });
    await finalizeAiChatTrace(handles, { error: err });
    await replyFeishuTextMessage(
      accessToken,
      input.replyMessageId,
      "处理写入确认失败，请稍后再试 🔄",
      replyInThread
    ).catch(() => {});
  }
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
  private subrequestCount = 0;

  constructor(
    private accessToken: string,
    public cardId: string,
    public toolElementId: string,
    public aiElementIds: string[]
  ) {}

  private enqueue<T>(task: (seq: number) => Promise<T>): Promise<T> {
    this.subrequestCount++;
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
    if (this.subrequestCount >= CARDKIT_MAX_SUBREQUESTS) return;

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

  async updateAiContent(fullText: string, isFinal = false): Promise<void> {
    if (!isFinal && this.subrequestCount >= CARDKIT_MAX_SUBREQUESTS) return;

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

  async finalize(fullText: string): Promise<{ overflowText: string }> {
    await this.updateAiContent(fullText, true);
    await this.enqueue((seq) =>
      finalizeFeishuStreamingCard(this.accessToken, this.cardId, seq)
    );
    return { overflowText: this.overflowText };
  }
}

// ─── 公开入口 ─────────────────────────────────────────────────────────────────

/**
 * 解析飞书 AI 会话键：按聊天归属划分 session，不按飞书话题 thread_id 拆分。
 * - 群聊 group:{chatId}：群内共享上下文
 * - 单聊 p2p:{openId}：主窗口与话题回复共用同一上下文
 */
export function buildFeishuThreadKey(
  message: { threadId?: string; chatId: string; chatType?: string; senderOpenId?: string },
  fallbackUserId?: string
): string {
  if (message.chatType === "group") {
    return `group:${message.chatId}`;
  }
  const p2pId = message.senderOpenId || fallbackUserId || "";
  return `p2p:${p2pId}`;
}

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

/** 用于中断正在进行的 AI 流 */
const threadAbortControllers = new Map<string, AbortController>();

/** 每次中断或 supersede 时递增，防止过期任务继续写卡片 */
const threadRunGeneration = new Map<string, number>();

function registerThreadAbortController(threadKey: string): AbortController {
  const controller = new AbortController();
  threadAbortControllers.set(threadKey, controller);
  return controller;
}

function isCurrentFeishuAiRun(threadKey: string, generation: number): boolean {
  return (threadRunGeneration.get(threadKey) ?? 0) === generation;
}

/**
 * 强制中断指定会话正在进行的 AI 处理（用于 /reset 或卡死自救）。
 * 会 abort 当前流、清空排队、使进行中的任务放弃写回。
 */
export function interruptFeishuAiThread(threadKey: string): void {
  const controller = threadAbortControllers.get(threadKey);
  if (controller && !controller.signal.aborted) {
    controller.abort();
  }
  threadAbortControllers.delete(threadKey);
  threadRunGeneration.set(threadKey, (threadRunGeneration.get(threadKey) ?? 0) + 1);
  threadQueueMap.delete(threadKey);
  log.info("interrupted feishu AI thread", { threadKey });
}

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
  const threadKey = buildFeishuThreadKey(message, actor.userId);
  const isReset = isFeishuChatResetCommand(text);

  if (isReset) {
    interruptFeishuAiThread(threadKey);
  }

  const previousTask = isReset
    ? Promise.resolve()
    : (threadQueueMap.get(threadKey) ?? Promise.resolve());

  const currentTask = previousTask
    .catch((err) => {
      log.warn("feishu AI queued task failed, continuing chain", {
        threadKey,
        error: err instanceof Error ? err.message : String(err),
      });
    })
    .then(() =>
      processSingleAiChat(ctx, message, text, actor, threadKey)
    );

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
  const runGeneration = threadRunGeneration.get(threadKey) ?? 0;
  const abortController = registerThreadAbortController(threadKey);
  const abortSignal = abortController.signal;

  let accessToken: string | undefined;
  let activeReactionPromise: Promise<string | null> | undefined =
    message.typingReactionPromise;
  let reactionFinalized = false;

  const finalizeReactionOnce = async (): Promise<void> => {
    if (reactionFinalized || !accessToken) return;
    reactionFinalized = true;
    await markFeishuTypingDone(
      accessToken,
      message.messageId,
      activeReactionPromise
    );
  };

  try {
    try {
      accessToken = await getTenantAccessToken(ctx.appId, ctx.appSecret);
    } catch (err) {
      log.error("failed to acquire feishu tenant access token", err, {
        messageId: message.messageId,
      });
      return;
    }

    if (message.isQueued) {
      activeReactionPromise = (async () => {
        const queuedReactionId = await message.typingReactionPromise;
        if (queuedReactionId) {
          await removeFeishuReaction(
            accessToken!,
            message.messageId,
            queuedReactionId
          ).catch(() => {});
        }
        return addFeishuReaction(
          accessToken!,
          message.messageId,
          "Typing"
        ).catch(() => null);
      })();
    }

    const conversationId = await resolveConversation(ctx.db, threadKey, actor);
    const store = createAiChatStore(ctx.db);
    let uiMessages = await store.listMessages(conversationId);
    const shouldReplyInThread = Boolean(message.threadId || message.replyInThread);
    const responseTimeoutMs = normalizeFeishuAiResponseTimeoutMs(
      ctx.aiResponseTimeoutMs
    );

    if (isFeishuChatResetCommand(text)) {
      await clearFeishuAiSession(ctx.db, threadKey);
      if (!isCurrentFeishuAiRun(threadKey, runGeneration)) return;
      await replyFeishuTextMessage(
        accessToken,
        message.messageId,
        "已中断当前处理并清空对话，可以重新开始了 🗑️",
        shouldReplyInThread
      ).catch(() => {});
      return;
    }

    const lastAssistant = [...uiMessages]
      .reverse()
      .find((m) => m.role === "assistant");
    const pendingApprovals = findPendingWriteContentApprovals(lastAssistant);
    const textApproval = parseFeishuTextApprovalDecision(
      stripFeishuSpeakerPrefix(text)
    );
    if (
      pendingApprovals.length > 0 &&
      !isApprovalContinuation(uiMessages) &&
      textApproval !== null
    ) {
      await resumeFeishuAiChatAfterApproval(
        ctx,
        {
          conversationId,
          approvalId: pendingApprovals[0]!.approvalId,
          approved: textApproval,
          actor,
          replyMessageId: message.messageId,
          replyInThread: shouldReplyInThread,
        }
      );
      return;
    }
    if (pendingApprovals.length > 0 && !isApprovalContinuation(uiMessages)) {
      log.info("feishu chat auto-rejecting stale pending write approval", {
        conversationId,
        approvalIds: pendingApprovals.map((item) => item.approvalId),
        messageId: message.messageId,
      });
      uiMessages = rejectAllPendingWriteContentApprovals(
        uiMessages,
        "用户已开始新对话，已自动取消待确认的写入"
      );
      const recoveredAssistant = [...uiMessages]
        .reverse()
        .find((item) => item.role === "assistant");
      if (recoveredAssistant) {
        await store.upsertMessage({
          id: recoveredAssistant.id,
          conversationId,
          role: "assistant",
          parts: recoveredAssistant.parts,
        });
      }
    }

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

    const handles = beginAiChatTrace({
      name: "feishu-chat",
      userId: actor.userId,
      sessionId: conversationId,
      input: text,
      metadata: { threadKey },
      tags: ["feishu"],
      env: ctx.aiEnv ?? {},
    });

    log.info("invoking AI model stream for feishu chat", {
      conversationId,
      messageCount: uiMessages.length,
      messageId: message.messageId,
      threadId: message.threadId ?? "",
      replyInThread: Boolean(message.replyInThread),
      shouldReplyInThread,
      responseTimeoutMs,
    });

    let cardSession: CardKitSession | null = null;

    try {
      const { cardId, toolElementId, aiElementIds } =
        await createFeishuStreamingCard(accessToken);
      await replyFeishuCardMessage(
        accessToken,
        message.messageId,
        cardId,
        shouldReplyInThread
      );
      cardSession = new CardKitSession(
        accessToken,
        cardId,
        toolElementId,
        aiElementIds
      );
    } catch (err) {
      log.error(
        "failed to create feishu CardKit streaming card, will fallback to text response",
        err,
        {
          messageId: message.messageId,
          conversationId,
        }
      );
    }

    try {
      const turn = await raceFeishuAgentTurn(
        {
          ctx,
          message,
          actor,
          threadKey,
          conversationId,
          uiMessages,
          accessToken,
          cardSession,
          handles,
          abortSignal,
        },
        abortController,
        responseTimeoutMs
      );

      if (!isCurrentFeishuAiRun(threadKey, runGeneration)) {
        log.info("feishu chat run superseded after agent turn", {
          conversationId,
          messageId: message.messageId,
        });
        return;
      }

      if (abortSignal.aborted) {
        log.info("feishu chat run aborted after agent turn", {
          conversationId,
          messageId: message.messageId,
        });
        return;
      }

      if (turn.pendingApproval) {
        const summary = formatWriteContentApprovalSummary(
          turn.pendingApproval.input
        );
        if (cardSession) {
          await cardSession.finalize(FEISHU_PENDING_WRITE_APPROVAL_NOTE);
        }
        try {
          await sendWriteContentApprovalCard(
            accessToken,
            message.messageId,
            conversationId,
            turn.pendingApproval.approvalId,
            summary,
            shouldReplyInThread
          );
        } catch (err) {
          log.error("feishu write approval card delivery failed", err, {
            conversationId,
            approvalId: turn.pendingApproval.approvalId,
            messageId: message.messageId,
          });
          const errorText =
            "写入确认卡片发送失败，请重新描述要写入的内容。\n\n发送 **/reset** 可重新开始对话。";
          if (cardSession) {
            await finalizeFeishuCardWithError(cardSession, errorText);
          } else {
            await replyFeishuTextMessage(
              accessToken,
              message.messageId,
              errorText,
              shouldReplyInThread
            ).catch(() => {});
          }
          await finalizeAiChatTrace(handles, { error: err });
          return;
        }
        await finalizeAiChatTrace(handles, {
          output: turn.fullResponse || "pending-write-approval",
        });
        return;
      }

      reactionFinalized = true;
      await finalizeFeishuChatResponse({
        accessToken,
        message,
        cardSession,
        fullResponse: turn.fullResponse,
        conversationId,
        handles,
        activeReactionPromise,
      });

      log.info("feishu AI chat response complete", {
        conversationId,
        usedCardKit: Boolean(cardSession),
        fullResponseLength: turn.fullResponse.length,
        responsePreview: turn.fullResponse.slice(0, 60),
      });
    } catch (err) {
      if (err instanceof FeishuAiTimeoutError) {
        if (isCurrentFeishuAiRun(threadKey, runGeneration)) {
          await silentlyFinalizeFeishuTimeout({
            cardSession,
            handles,
            accessToken,
            message,
            conversationId,
            timeoutMs: responseTimeoutMs,
            activeReactionPromise,
          });
          reactionFinalized = true;
        }
        return;
      }
      if (abortSignal.aborted || !isCurrentFeishuAiRun(threadKey, runGeneration)) {
        log.info("feishu chat run aborted or superseded", {
          conversationId,
          messageId: message.messageId,
          aborted: abortSignal.aborted,
        });
        return;
      }
      log.error("feishu AI chat failed", err, {
        conversationId,
        messageId: message.messageId,
      });
      await finalizeAiChatTrace(handles, { error: err });
      const errorText =
        "AI 回复失败，请稍后再试 🔄\n\n发送 **/reset** 或 **重新开始** 可中断并清空当前对话。";
      if (cardSession) {
        await finalizeFeishuCardWithError(cardSession, errorText);
      } else {
        await replyFeishuTextMessage(
          accessToken,
          message.messageId,
          errorText,
          shouldReplyInThread
        ).catch(() => {});
      }
    }
  } catch (err) {
    log.error("feishu AI chat setup failed", err, {
      messageId: message.messageId,
      threadKey,
    });
    if (accessToken) {
      await replyFeishuTextMessage(
        accessToken,
        message.messageId,
        "AI 回复失败，请稍后再试 🔄\n\n发送 **/reset** 可清空当前对话。",
        Boolean(message.threadId || message.replyInThread)
      ).catch(() => {});
    }
  } finally {
    await finalizeReactionOnce();
  }
}
