import { Hono } from "hono";
import type { Context } from "hono";
import {
  convertToModelMessages,
  streamText,
  stepCountIs,
  type UIMessage,
} from "ai";
import type { AiContextMode } from "../services/ai-chat-store.js";
import {
  createAiChatStore,
  extractTextFromParts,
  trimMessagesForModel,
} from "../services/ai-chat-store.js";
import { AiModelConfigError, resolveModel, type AiRuntimeEnv } from "../services/ai-model.js";
import { buildSystemPrompt } from "../services/ai-prompt.js";
import { createAiTools } from "../services/ai-tools.js";
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

function getLatestUserMessage(messages: UIMessage[]): UIMessage | null {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i]?.role === "user") return messages[i];
  }
  return null;
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
    const latestUser = getLatestUserMessage(incoming);
    if (!latestUser) {
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
        uiMessages = await store.listMessages(conversationId);
        const exists = uiMessages.some((message) => message.id === latestUser.id);
        if (!exists) {
          await store.insertMessage({
            conversationId,
            role: "user",
            parts: latestUser.parts,
            author: session.author,
            id: latestUser.id,
          });
          uiMessages = [...uiMessages, latestUser];
        }
      } else {
        const title = store.buildConversationTitle(
          extractTextFromParts(latestUser.parts)
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
            parts: latestUser.parts,
            author: session.author,
            id: latestUser.id,
          },
        });
        conversationId = created.conversation.id;
        uiMessages = [latestUser];
      }

      const { model, provider, modelId } = await resolveModel(db, env);
      const system = await buildSystemPrompt(db, context);
      const tools = createAiTools(db);
      const modelMessages = await convertToModelMessages(
        trimMessagesForModel(uiMessages)
      );

      const startedAt = Date.now();
      const result = streamText({
        model,
        system,
        messages: modelMessages,
        tools,
        stopWhen: stepCountIs(5),
        onFinish: async () => {
          log.info("chat finished", {
            conversationId,
            provider,
            modelId,
            durationMs: Date.now() - startedAt,
          });
        },
        onError: ({ error }) => {
          log.error("stream error", { conversationId, provider, error });
        },
      });

      const responseConversationId = conversationId;
      return result.toUIMessageStreamResponse({
        headers: {
          "X-Conversation-Id": responseConversationId,
        },
        originalMessages: uiMessages,
        onFinish: async ({ responseMessage }) => {
          try {
            await store.insertMessage({
              conversationId: responseConversationId,
              role: "assistant",
              parts: responseMessage.parts,
            });
          } catch (err) {
            log.error("persist assistant failed", err);
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

  return ai;
}
