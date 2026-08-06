import { Hono } from "hono";
import type { Context } from "hono";
import { generateText, streamText, type UIMessage } from "ai";
import { createWorkersAI } from "workers-ai-provider";
import { transcribeAudioWithWorkersAi } from "../services/workers-ai-whisper.js";
import { transcribeAudioWithDashScope } from "../services/dashscope-voice.js";
import { readProviderKey, resolveAlibabaApiKey, resolveModel } from "../services/ai-model.js";
import { APP_SETTING_KEYS } from "../app-settings.js";
import type { AiContextMode } from "../services/ai-chat-store.js";
import {
  createAiChatStore,
  extractTextFromParts,
} from "../services/ai-chat-store.js";
import {
  attachAgentLangfuseRecorder,
  beginAiChatTrace,
  finalizeAiChatTrace,
  prepareAiChatAgent,
  streamAiChat,
} from "../services/ai-chat-runtime.js";
import {
  getLatestUserMessage,
  isApprovalContinuation,
} from "../services/ai-tool-approval.js";
import { prepareApprovalContinuationMessages } from "../services/write-content-approval-completion.js";
import { AiModelConfigError, type AiRuntimeEnv } from "../services/ai-model.js";
import { checkAiRateLimit } from "../services/ai-rate-limit.js";
import {
  listDeepseekModels,
  resolveDeepseekApiKey,
  testDeepseekConnection,
} from "../services/deepseek-models.js";
import {
  listOpenAiCompatibleModels,
  readConnectionApiKey,
  testOpenAiCompatibleConnection,
} from "../services/ai-connections.js";
import {
  getWorkersAiModelCredentials,
  listWorkersAiChatModels,
} from "../services/workers-ai-models.js";
import { readSettingsMap } from "../db/settings-store.js";
import { createLogger } from "../lib/logger.js";
import type { SessionAuthor } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("ai");

export interface AiRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getEnv?: (c: Context) => AiRuntimeEnv;
}

interface AiChatContext {
  mode?: AiContextMode;
  articleId?: string;
}

interface AiChatBody {
  messages?: UIMessage[];
  conversationId?: string;
  id?: string;
  context?: AiChatContext;
}

function normalizeConversationId(raw?: string): string {
  const trimmed = raw?.trim() ?? "";
  if (!trimmed || !trimmed.startsWith("aiconv_")) return "";
  return trimmed;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: AiRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) {
    return c.json({ error: "账号身份无效，请使用「小圆子」或「小麟子」注册/登录" }, 400);
  }
  return sessionAuthor;
}

function getLatestUserMessageFromIncoming(messages: UIMessage[]): UIMessage | null {
  return getLatestUserMessage(messages);
}

async function syncAssistantMessage(
  store: ReturnType<typeof createAiChatStore>,
  conversationId: string,
  message: UIMessage
): Promise<void> {
  await store.upsertMessage({
    id: message.id,
    conversationId,
    role: "assistant",
    parts: message.parts,
  });
}

function normalizeContext(raw?: AiChatContext): {
  mode: AiContextMode;
  articleId?: string;
} {
  const mode = raw?.mode === "article" ? "article" : "global";
  if (mode === "article" && !raw?.articleId?.trim()) {
    return { mode: "global" };
  }
  return {
    mode,
    articleId: mode === "article" ? raw?.articleId?.trim() : undefined,
  };
}

export function createAiRoutes(getDb: DbProvider, options: AiRouteOptions = {}) {
  const ai = new Hono();

  ai.get("/workers-models", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const env = options.getEnv?.(c) ?? {};
    const credentials = getWorkersAiModelCredentials(env);
    const result = await listWorkersAiChatModels(credentials);
    return c.json(result);
  });

  ai.get("/deepseek-models", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const env = options.getEnv?.(c) ?? {};
    const db = await getDb(c);
    const settingsMap = await readSettingsMap(db);
    const apiKey = await resolveDeepseekApiKey(settingsMap, env);
    const result = await listDeepseekModels(apiKey);
    return c.json(result);
  });

  ai.post("/deepseek-test", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { deepseekKey?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const env = options.getEnv?.(c) ?? {};
    const db = await getDb(c);
    const settingsMap = await readSettingsMap(db);
    const inlineKey = body.deepseekKey?.trim() ?? "";
    const apiKey =
      inlineKey || (await resolveDeepseekApiKey(settingsMap, env)) || null;

    if (!apiKey) {
      return c.json({ error: "请先填写 DeepSeek API Key" }, 400);
    }

    try {
      await testDeepseekConnection(apiKey);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "连接失败，请检查 API Key" }, 422);
    }
  });

  ai.post("/connections/test", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { baseUrl?: string; apiKey?: string; connectionId?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const env = options.getEnv?.(c) ?? {};
    const db = await getDb(c);
    const settingsMap = await readSettingsMap(db);
    const inlineKey = body.apiKey?.trim() ?? "";
    const connectionId = body.connectionId?.trim() ?? "";
    const storedKey = connectionId
      ? await readConnectionApiKey(
          settingsMap,
          connectionId,
          env.BETTER_AUTH_SECRET
        )
      : null;
    const apiKey = inlineKey || storedKey;
    const baseUrl = body.baseUrl?.trim() ?? "";

    if (!baseUrl) {
      return c.json({ error: "请填写 Base URL" }, 400);
    }
    if (!apiKey) {
      return c.json({ error: "请先填写 API Key" }, 400);
    }

    try {
      await testOpenAiCompatibleConnection(baseUrl, apiKey);
      return c.json({ ok: true });
    } catch {
      return c.json({ error: "连接失败，请检查 Base URL 与 API Key" }, 422);
    }
  });

  ai.post("/connections/discover", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { baseUrl?: string; apiKey?: string; connectionId?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const env = options.getEnv?.(c) ?? {};
    const db = await getDb(c);
    const settingsMap = await readSettingsMap(db);
    const inlineKey = body.apiKey?.trim() ?? "";
    const connectionId = body.connectionId?.trim() ?? "";
    const storedKey = connectionId
      ? await readConnectionApiKey(
          settingsMap,
          connectionId,
          env.BETTER_AUTH_SECRET
        )
      : null;
    const apiKey = inlineKey || storedKey;
    const baseUrl = body.baseUrl?.trim() ?? "";

    if (!baseUrl) {
      return c.json({ error: "请填写 Base URL" }, 400);
    }
    if (!apiKey) {
      return c.json({ error: "请先填写 API Key" }, 400);
    }

    try {
      const models = await listOpenAiCompatibleModels(baseUrl, apiKey);
      return c.json({ models });
    } catch (err) {
      log.error("discover models failed", err);
      return c.json({ error: "拉取模型列表失败" }, 422);
    }
  });

  ai.get("/conversations", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const store = createAiChatStore(db);
    const articleId = c.req.query("articleId")?.trim() || undefined;
    const items = await store.listConversations(session.userId, { articleId });
    return c.json({ items });
  });

  ai.post("/conversations", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { context?: AiChatContext; title?: string } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const context = normalizeContext(body.context);
    if (context.mode === "article" && !context.articleId) {
      return c.json({ error: "文章上下文缺少 articleId" }, 400);
    }

    const db = await getDb(c);
    const store = createAiChatStore(db);
    const conv = await store.createConversation({
      userId: session.userId,
      author: session.author,
      title: body.title?.trim() || store.buildConversationTitle(""),
      contextMode: context.mode,
      articleId: context.articleId ?? null,
      shared: false,
    });

    return c.json({
      id: conv.id,
      title: conv.title,
      contextMode: conv.contextMode,
      articleId: conv.articleId ?? undefined,
      shared: conv.shared,
      isOwner: true,
      ownerAuthor: conv.author,
      updatedAt: conv.updatedAt,
      preview: "",
    });
  });

  ai.get("/conversations/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const store = createAiChatStore(db);
    const conv = await store.getConversation(c.req.param("id"));
    if (!conv || !(await store.canAccessConversation(conv, session.userId))) {
      return c.json({ error: "会话不存在或无权访问" }, 404);
    }

    const messages = await store.listMessages(conv.id);
    return c.json({
      id: conv.id,
      title: conv.title,
      contextMode: conv.contextMode,
      articleId: conv.articleId ?? undefined,
      shared: conv.shared,
      isOwner: conv.userId === session.userId,
      ownerAuthor: conv.author,
      updatedAt: conv.updatedAt,
      messages,
    });
  });

  ai.patch("/conversations/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { title?: string; shared?: boolean } = {};
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const db = await getDb(c);
    const store = createAiChatStore(db);
    const conv = await store.getConversation(c.req.param("id"));
    if (!conv) return c.json({ error: "会话不存在" }, 404);
    if (conv.userId !== session.userId) {
      return c.json({ error: "仅所有者可修改此会话" }, 403);
    }

    const patch: { title?: string; shared?: boolean } = {};
    if (body.title !== undefined) patch.title = body.title.trim() || conv.title;
    if (body.shared !== undefined) patch.shared = body.shared;

    await store.updateConversation(conv.id, patch);
    const next = await store.getConversation(conv.id);
    return c.json({
      id: next!.id,
      title: next!.title,
      shared: next!.shared,
      updatedAt: next!.updatedAt,
    });
  });

  ai.delete("/conversations/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const store = createAiChatStore(db);
    const conv = await store.getConversation(c.req.param("id"));
    if (!conv) return c.json({ error: "会话不存在" }, 404);
    if (conv.userId !== session.userId) {
      return c.json({ error: "仅所有者可删除此会话" }, 403);
    }

    await store.softDeleteConversation(conv.id);
    return c.json({ ok: true });
  });

  ai.post("/chat", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const limit = checkAiRateLimit(session.userId);
    if (!limit.allowed) {
      return c.json(
        { error: `请求过于频繁，请 ${limit.retryAfterSec ?? 60} 秒后重试` },
        429
      );
    }

    let body: AiChatBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const incoming = Array.isArray(body.messages) ? body.messages : [];
    const approvalContinuation = isApprovalContinuation(incoming);
    const latestUser = getLatestUserMessageFromIncoming(incoming);
    if (!latestUser && !approvalContinuation) {
      return c.json({ error: "缺少用户消息" }, 400);
    }

    const context = normalizeContext(body.context);
    if (context.mode === "article" && !context.articleId) {
      return c.json({ error: "文章上下文缺少 articleId" }, 400);
    }

    const db = await getDb(c);
    const store = createAiChatStore(db);
    const env = options.getEnv?.(c) ?? (process.env as AiRuntimeEnv);

    let conversationId = normalizeConversationId(body.conversationId);
    let uiMessages: UIMessage[] = [];

    try {
      if (conversationId) {
        const conv = await store.getConversation(conversationId);
        if (!conv || !(await store.canAccessConversation(conv, session.userId))) {
          return c.json({ error: "会话不存在或无权访问" }, 404);
        }

        if (approvalContinuation) {
          const storedMessages = await store.listMessages(conversationId);
          const prepared = prepareApprovalContinuationMessages(
            incoming,
            storedMessages
          );
          uiMessages = prepared.messages;
          if (prepared.assistantMessage) {
            await syncAssistantMessage(
              store,
              conversationId,
              prepared.assistantMessage
            );
          }
        } else {
          uiMessages = await store.listMessages(conversationId);
          const exists = uiMessages.some((message) => message.id === latestUser!.id);
          if (!exists) {
            await store.insertMessage({
              conversationId,
              role: "user",
              parts: latestUser!.parts,
              author: session.author,
              id: latestUser!.id,
            });
            uiMessages = [...uiMessages, latestUser!];
          }
        }
      } else {
        if (approvalContinuation) {
          return c.json({ error: "审批续聊需要已有会话" }, 400);
        }
        const title = store.buildConversationTitle(
          extractTextFromParts(latestUser!.parts)
        );
        const created = await store.createConversationWithMessage({
          userId: session.userId,
          author: session.author,
          title,
          contextMode: context.mode,
          articleId: context.articleId ?? null,
          shared: false,
          message: {
            role: "user",
            parts: latestUser!.parts,
            author: session.author,
            id: latestUser!.id,
          },
        });
        conversationId = created.conversation.id;
        uiMessages = [latestUser!];
     }

      const handles = beginAiChatTrace({
        name: "web-chat",
        userId: session.userId,
        sessionId: conversationId,
        input: approvalContinuation
          ? "tool-approval-continuation"
          : extractTextFromParts(latestUser!.parts),
        metadata: {
          contextMode: context.mode,
          articleId: context.articleId,
        },
        tags: ["web"],
        env,
      });

      const agent = await prepareAiChatAgent({
        db,
        env,
        uiMessages,
        promptContext: context,
        actor: {
          userId: session.userId,
          author: session.author,
        },
        trace: handles.trace,
      });

      attachAgentLangfuseRecorder(handles, {
        modelId: agent.modelId,
        provider: agent.provider,
        system: agent.system,
        tools: agent.tools,
        initialMessages: agent.modelMessages,
      });
      handles.trace?.updateTrace({
        metadata: {
          provider: agent.provider,
          modelId: agent.modelId,
          contextMode: context.mode,
          articleId: context.articleId,
        },
        tags: ["web", agent.provider],
      });

      const result = streamAiChat({
        model: agent.model,
        system: agent.system,
        messages: agent.modelMessages,
        tools: agent.tools,
        conversationId,
        provider: agent.provider,
        modelId: agent.modelId,
        env,
        log,
        trace: handles.trace,
        agentRecorder: handles.agentRecorder ?? undefined,
        onError: ({ error }) => {
          log.error("stream error", error, {
            conversationId,
            provider: agent.provider,
            modelId: agent.modelId,
          });
          void finalizeAiChatTrace(handles, { error }).catch((e) =>
            log.error("langfuse error flush failed", e)
          );
        },
      });

      const responseConversationId = conversationId;
      const streamOriginalMessages =
        incoming.length > 0 ? incoming : uiMessages;

      return result.toUIMessageStreamResponse({
        headers: {
          "X-Conversation-Id": responseConversationId,
        },
        originalMessages: streamOriginalMessages,
        onError: (error) => {
          log.error("ui message stream error", error, {
            conversationId: responseConversationId,
            provider: agent.provider,
            modelId: agent.modelId,
          });
          if (process.env.NODE_ENV !== "production") {
            return error instanceof Error ? error.message : String(error);
          }
          return "An error occurred.";
        },
        onFinish: async ({ responseMessage }) => {
          if (handles.finalized) return;
          try {
            const outputText = extractTextFromParts(responseMessage.parts);
            await finalizeAiChatTrace(handles, { output: outputText });
            await store.upsertMessage({
              conversationId: responseConversationId,
              role: "assistant",
              parts: responseMessage.parts,
              id: responseMessage.id?.trim() || undefined,
            });
          } catch (err) {
            log.error("persist assistant failed", err);
            await finalizeAiChatTrace(handles).catch(() => {});
          }
        },
      });
    } catch (err) {
      if (err instanceof AiModelConfigError) {
        return c.json({ error: err.message }, err.status);
      }
      log.error("chat failed", err);
      return c.json({ error: "模型服务暂时不可用，请稍后重试" }, 502);
    }
  });

  ai.post("/voice-transcribe", async (c) => {
    try {
      const authorRes = await requireSessionAuthor(c, options.getSessionAuthor);
      if (authorRes instanceof Response) return authorRes;

      const env = options.getEnv ? options.getEnv(c) : (process.env as AiRuntimeEnv);
      const body = await c.req.parseBody();
      const file = body["file"];
      const mode = (body["mode"] as string) || "smooth";
      const contextText = (body["contextText"] as string) || "";

      if (!file || !(file instanceof File)) {
        return c.json({ error: "请上传语音音频文件" }, 400);
      }

      const startTime = Date.now();
      const buffer = await file.arrayBuffer();

      const dbInstance = await getDb(c);
      const settingsMap = await readSettingsMap(dbInstance);
      const dashscopeApiKey = await resolveAlibabaApiKey(settingsMap, env);
      
      // 1. 调用阿里 SenseVoice / qwen3-asr-flash 模型转写语音
      const sttStartTime = Date.now();
      const { text: rawText, provider } = await transcribeAudioWithDashScope(
        buffer,
        file.name,
        env,
        dashscopeApiKey || undefined
      );
      const sttDurationMs = Date.now() - sttStartTime;

      log.info(`[Voice Performance Diagnostic] 语音识别 (${provider}) 耗时: ${sttDurationMs}ms`, {
        sttDurationMs,
        provider,
        audioSizeBytes: buffer.byteLength,
        rawText,
      });

      if (!rawText || !rawText.trim()) {
        return c.json({ error: "未能从语音中识别出文字，请清晰录音后再试" }, 422);
      }

      // 如果选择“保持原文”，直接以 JSON 返回
      if (mode === "raw") {
        return c.json({ rawText, refinedText: rawText, text: rawText });
      }

      // 2. 强制使用 DeepSeek v4-flash 模型进行文本润色（禁止退回到 Cloudflare Workers AI）
      const deepseekKey =
        (await resolveDeepseekApiKey(settingsMap, env)) ||
        env.DEEPSEEK_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        "";

      if (!deepseekKey || !deepseekKey.trim()) {
        return c.json({ error: "未配置 DEEPSEEK_API_KEY，请在系统设置中填入 DeepSeek API Key" }, 422);
      }

      const { createDeepSeek } = await import("@ai-sdk/deepseek");
      const deepseek = createDeepSeek({ apiKey: deepseekKey.trim() });
      const modelToUse = deepseek("deepseek-v4-flash");

      let systemPrompt = `你是一位专业的语言表达与编辑专家。请修饰用户的口语表述：\n1. 剔除所有口头禅（如“额”、“然后”、“那个”、“就是”）、无意义停顿与重复词。\n2. 自动识别口语中的自我修正（如“不对”、“更正为”、“我是说”、“不是...”），用后文正确说法直接替换修正前文。\n3. 修复语病、错别字，补齐正确标点符号，保持作者实际意图。\n4. 必须强制使用简体中文 (Simplified Chinese) 输出，绝不要出现任何繁体字。\n5. 直接输出润色后的文本，绝不要包含“好的”、“这是润色后的结果：”等任何解释性套话。`;

      if (contextText.trim()) {
        systemPrompt += `\n6. [上下文专有名词参考] 用户当前文章/编辑框的上下文如下:\n"""\n${contextText.trim().slice(0, 500)}\n"""\n请结合上述上下文中的专有名词（如人名“小圆子”、“小麟子”、专业术语、文章标题），自动纠正口语转写中的同音错别字。`;
      }

      const polishStartTime = Date.now();
      log.info(`[Voice Refine Started] 开始调用 DeepSeek v4-flash 流式润色...`, {
        mode,
        rawTextLength: rawText.length,
      });

      const result = streamText({
        model: modelToUse,
        system: systemPrompt,
        prompt: rawText,
        onFinish: ({ text: refinedText }) => {
          const polishDurationMs = Date.now() - polishStartTime;
          log.info(`[Voice Refine Finished] DeepSeek v4-flash 润色完成，耗时: ${polishDurationMs}ms`, {
            polishDurationMs,
            refinedText,
          });
        },
      });

      return result.toTextStreamResponse({
        headers: {
          "X-Raw-Text": encodeURIComponent(rawText),
        },
      });
    } catch (err: any) {
      log.error("voice-transcribe failed", { error: err?.message || String(err) });
      return c.json({ error: err.message || "语音识别与润色失败" }, 500);
    }
  });

  ai.post("/deepseek-test", async (c) => {
    try {
      const authorRes = await requireSessionAuthor(c, options.getSessionAuthor);
      if (authorRes instanceof Response) return authorRes;

      const env = options.getEnv ? options.getEnv(c) : (process.env as AiRuntimeEnv);
      const dbInstance = await getDb(c);
      const settingsMap = await readSettingsMap(dbInstance);
      const body = await c.req.json<{ deepseekKey?: string }>().catch((): { deepseekKey?: string } => ({}));
      
      const apiKey =
        body.deepseekKey?.trim() ||
        (await resolveDeepseekApiKey(settingsMap, env)) ||
        env.DEEPSEEK_API_KEY ||
        process.env.DEEPSEEK_API_KEY ||
        "";

      if (!apiKey) {
        return c.json({ error: "未提供 API Key" }, 400);
      }

      const { createDeepSeek } = await import("@ai-sdk/deepseek");
      const deepseek = createDeepSeek({ apiKey });
      await generateText({
        model: deepseek("deepseek-v4-flash"),
        prompt: "hi",
      });

      return c.json({ ok: true });
    } catch (err: any) {
      log.error("deepseek-test failed", err);
      return c.json({ error: err?.message || "连接 DeepSeek 失败" }, 422);
    }
  });

  ai.post("/alibaba-test", async (c) => {
    try {
      const authorRes = await requireSessionAuthor(c, options.getSessionAuthor);
      if (authorRes instanceof Response) return authorRes;

      const env = options.getEnv ? options.getEnv(c) : (process.env as AiRuntimeEnv);
      const dbInstance = await getDb(c);
      const settingsMap = await readSettingsMap(dbInstance);
      const body = await c.req.json<{ alibabaKey?: string }>().catch((): { alibabaKey?: string } => ({}));

      const apiKey =
        body.alibabaKey?.trim() ||
        (await resolveAlibabaApiKey(settingsMap, env)) ||
        "";

      if (!apiKey) {
        return c.json({ error: "未提供 API Key" }, 400);
      }

      const { createAlibaba } = await import("@ai-sdk/alibaba");
      const alibaba = createAlibaba({
        apiKey,
        baseURL: process.env.DASHSCOPE_BASE_URL || "https://dashscope.aliyuncs.com/compatible-mode/v1",
      });
      await generateText({
        model: alibaba("qwen-turbo"),
        prompt: "hi",
      });

      return c.json({ ok: true });
    } catch (err: any) {
      log.error("alibaba-test failed", err);
      return c.json({ error: err?.message || "连接阿里百炼失败" }, 422);
    }
  });

  return ai;
}
