import { Hono } from "hono";
import type { Context } from "hono";
import {
  buildFeishuConfigPublic,
  FEISHU_SETTING_KEYS,
  loadFeishuRuntime,
  parseFeishuConfig,
  serializeFeishuConfig,
  normalizeFeishuAiResponseTimeoutMs,
  type FeishuConfigPublic,
  type FeishuConfigStored,
  type FeishuAuthorOpenIds,
} from "../services/feishu-settings.js";
import {
  clearTenantAccessTokenCache,
  getFeishuBotOpenId,
  testFeishuConnection,
} from "../services/feishu-api.js";
import {
  parseFeishuInboundMentions,
  isFeishuBotMentioned,
} from "../services/feishu-message-content.js";
import { handleFeishuCallback } from "../services/feishu-callback.js";
import {
  parseLarkInboundBody,
  tryParseUrlVerification,
  verificationTokenMismatch,
  verifyLarkInboundSignature,
  type LarkInboundPayload,
} from "../services/feishu-webhook.js";
import {
  pruneFeishuMessageDedup,
  tryClaimFeishuMessage,
} from "../services/feishu-dedup.js";
import { processFeishuInboundMessage } from "../services/feishu-inbound.js";
import {
  deleteSetting,
  readSettingsMap,
  upsertSetting,
} from "../db/settings-store.js";
import { encryptSettingSecret } from "../lib/secret-crypto.js";
import { createLogger } from "../lib/logger.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";
import type { AiRuntimeEnv } from "../services/ai-model.js";
import type { NotifyRuntime } from "../services/notify.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("integrations");

export interface IntegrationsRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getSecret?: (c: Context) => string | undefined;
  getWebhookBaseUrl?: (c: Context) => string;
  getNotifyRuntime?: (c: Context) => NotifyRuntime;
  getAiEnv?: (c: Context) => AiRuntimeEnv | undefined;
  saveAsset?: (
    input: { filename: string; mimeType: string; body: ArrayBuffer },
    c: Context
  ) => Promise<string>;
  waitUntil?: (c: Context, task: Promise<unknown>) => void;
}

function mergeAuthorOpenIds(
  current: FeishuAuthorOpenIds,
  patch: Record<string, string> | undefined
): FeishuAuthorOpenIds {
  if (!patch) return current;
  const next = { ...current };
  for (const [key, value] of Object.entries(patch)) {
    if (value !== undefined) next[key] = value.trim();
  }
  return next;
}

interface FeishuPutBody {
  enabled?: boolean;
  appId?: string;
  appSecret?: string | null;
  encryptKey?: string | null;
  verificationToken?: string;
  authorOpenIds?: Record<string, string>;
  allowedGroupChatIds?: string[];
  mergeWindowMs?: number;
  homeChatId?: string;
  replyInThread?: boolean;
  aiResponseTimeoutMs?: number;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: IntegrationsRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) {
    return c.json({ error: INVALID_SESSION_ERROR }, 400);
  }
  return sessionAuthor;
}

function resolveEventWebhookUrl(
  c: Context,
  options: IntegrationsRouteOptions
): string {
  const base = options.getWebhookBaseUrl?.(c) ?? new URL(c.req.url).origin;
  return `${base.replace(/\/$/, "")}/api/integrations/feishu/events`;
}

function resolveCallbackWebhookUrl(
  c: Context,
  options: IntegrationsRouteOptions
): string {
  const base = options.getWebhookBaseUrl?.(c) ?? new URL(c.req.url).origin;
  return `${base.replace(/\/$/, "")}/api/integrations/feishu/callbacks`;
}

function resolveWebhookUrls(
  c: Context,
  options: IntegrationsRouteOptions
): { eventWebhookUrl: string; callbackWebhookUrl: string } {
  return {
    eventWebhookUrl: resolveEventWebhookUrl(c, options),
    callbackWebhookUrl: resolveCallbackWebhookUrl(c, options),
  };
}

function scheduleBackground(
  c: Context,
  options: IntegrationsRouteOptions,
  task: Promise<unknown>
): void {
  if (options.waitUntil) {
    options.waitUntil(c, task);
    return;
  }
  void task.catch((err) => log.error("background task failed", err));
}

interface LarkEventEnvelope extends LarkInboundPayload {
  event?: {
    sender?: {
      sender_id?: { open_id?: string; user_id?: string };
    };
    message?: {
      message_id?: string;
      chat_id?: string;
      chat_type?: string;
      message_type?: string;
      content?: string;
      mentions?: unknown[];
    };
  };
}

async function handleLarkInboundWebhook(
  c: Context,
  rawBody: string,
  runtime: Awaited<ReturnType<typeof loadFeishuRuntime>>,
  onPayload: (payload: LarkInboundPayload) => Promise<Response | Record<string, unknown>>
): Promise<Response> {
  log.info("feishu inbound webhook received", { bodyLength: rawBody.length });

  const handshake = await tryParseUrlVerification(
    rawBody,
    runtime.secrets.encryptKey
  );
  if (handshake?.challenge) {
    if (verificationTokenMismatch(runtime, handshake)) {
      log.warn("feishu url_verification token mismatch");
      return c.json({ error: "invalid token" }, 401);
    }
    log.info("feishu url_verification handshake successful");
    return c.json({ challenge: handshake.challenge });
  }

  if (runtime.secrets.encryptKey) {
    const valid = await verifyLarkInboundSignature(
      c,
      runtime.secrets.encryptKey,
      rawBody
    );
    if (!valid) {
      log.warn("feishu inbound signature verification failed");
      return c.json({ error: "invalid signature" }, 401);
    }
  }

  let payload: LarkInboundPayload;
  try {
    payload = await parseLarkInboundBody(
      rawBody,
      runtime.secrets.encryptKey
    );
  } catch (err) {
    log.error("feishu inbound payload parsing failed", err);
    return c.json({ error: "invalid payload" }, 400);
  }

  if (payload.type === "url_verification" && payload.challenge) {
    if (verificationTokenMismatch(runtime, payload)) {
      log.warn("feishu url_verification payload token mismatch");
      return c.json({ error: "invalid token" }, 401);
    }
    log.info("feishu url_verification payload handshake successful");
    return c.json({ challenge: payload.challenge });
  }

  if (verificationTokenMismatch(runtime, payload)) {
    log.warn("feishu payload verification token mismatch", { type: payload.type });
    return c.json({ error: "invalid token" }, 401);
  }

  const result = await onPayload(payload);
  if (result instanceof Response) return result;
  return c.json(result);
}

async function handleLarkEvent(
  c: Context,
  db: any,
  options: IntegrationsRouteOptions,
  payload: LarkEventEnvelope
): Promise<void> {
  if (payload.type === "url_verification" && payload.challenge) {
    log.info("ignoring url_verification in handleLarkEvent");
    return;
  }

  const eventType = payload.header?.event_type;
  const eventId = payload.header?.event_id;
  log.info("feishu event envelope received", { eventType, eventId });

  if (eventType !== "im.message.receive_v1" || !payload.event?.message) {
    log.info("ignoring feishu event (not im.message.receive_v1)", { eventType, eventId });
    return;
  }

  const runtime = await loadFeishuRuntime(db, options.getSecret?.(c) ?? "");
  if (!runtime.config.enabled) {
    log.info("ignoring feishu event: feishu integration is disabled", { eventId });
    return;
  }

  const message = payload.event.message;
  const senderOpenId = payload.event.sender?.sender_id?.open_id?.trim() ?? "";
  const messageId = message.message_id?.trim() ?? "";
  const chatId = message.chat_id?.trim() ?? "";
  const threadId = (message as { thread_id?: string }).thread_id?.trim() ?? "";
  if (!messageId || !chatId || !senderOpenId) {
    log.warn("ignoring feishu message event: missing required ids", { messageId, chatId, senderOpenId, eventId });
    return;
  }

  if (!runtime.secrets.appSecret || !runtime.config.appId) {
    log.warn("ignoring feishu message event: missing appId or appSecret", { appId: runtime.config.appId, eventId });
    return;
  }

  const claimed = await tryClaimFeishuMessage(db, messageId);
  if (!claimed) {
    log.info("ignoring duplicate feishu message (deduplicated)", { messageId, chatId, eventId });
    return;
  }

  log.info("processing feishu message event", {
    messageId,
    chatId,
    threadId,
    chatType: message.chat_type ?? "p2p",
    messageType: message.message_type ?? "text",
    senderOpenId,
    eventId,
  });

  const mentions = parseFeishuInboundMentions(message.mentions);
  const botOpenId = await getFeishuBotOpenId(
    runtime.config.appId,
    runtime.secrets.appSecret
  );
  const hasGroupMention = isFeishuBotMentioned(mentions, botOpenId ?? undefined);

  await processFeishuInboundMessage(
    {
      db,
      config: runtime.config,
      appId: runtime.config.appId,
      appSecret: runtime.secrets.appSecret,
      baseUrl:
        options.getWebhookBaseUrl?.(c)?.replace(/\/$/, "") ??
        new URL(c.req.url).origin,
      notifyRuntime:
        options.getNotifyRuntime?.(c) ?? {
          baseUrl: options.getWebhookBaseUrl?.(c) ?? "",
          secret: options.getSecret?.(c) ?? "",
        },
      aiEnv: options.getAiEnv?.(c),
      saveAsset: async (input) => {
        if (!options.saveAsset) {
          throw new Error("asset storage not configured");
        }
        return options.saveAsset(input, c);
      },
    },
    {
      messageId,
      chatId,
      threadId,
      chatType: message.chat_type ?? "p2p",
      messageType: message.message_type ?? "text",
      content: message.content ?? "",
      senderOpenId,
      mentions,
      botOpenId: botOpenId ?? undefined,
    },
    { hasGroupMention }
  );

  await pruneFeishuMessageDedup(db);
}

export function createIntegrationsRoutes(
  getDb: DbProvider,
  options: IntegrationsRouteOptions = {}
) {
  const routes = new Hono();

  routes.get("/feishu", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const secret = options.getSecret?.(c) ?? "";
    const runtime = await loadFeishuRuntime(db, secret);
    const urls = resolveWebhookUrls(c, options);
    return c.json(
      buildFeishuConfigPublic(
        runtime.config,
        runtime.hasAppSecret,
        runtime.hasEncryptKey,
        urls.eventWebhookUrl,
        urls.callbackWebhookUrl
      ) satisfies FeishuConfigPublic
    );
  });

  routes.put("/feishu", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: FeishuPutBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const db = await getDb(c);
    const secret = options.getSecret?.(c);
    const settingsMap = await readSettingsMap(db);
    const current = parseFeishuConfig(settingsMap[FEISHU_SETTING_KEYS.config]);

    const next: FeishuConfigStored = {
      ...current,
      enabled: body.enabled ?? current.enabled,
      appId: body.appId !== undefined ? body.appId.trim() : current.appId,
      verificationToken:
        body.verificationToken !== undefined
          ? body.verificationToken.trim()
          : current.verificationToken,
      authorOpenIds: mergeAuthorOpenIds(current.authorOpenIds, body.authorOpenIds),
      allowedGroupChatIds:
        body.allowedGroupChatIds !== undefined
          ? body.allowedGroupChatIds
              .map((id) => id.trim())
              .filter(Boolean)
          : current.allowedGroupChatIds,
      mergeWindowMs:
        body.mergeWindowMs !== undefined
          ? Math.max(0, body.mergeWindowMs)
          : current.mergeWindowMs,
      homeChatId:
        body.homeChatId !== undefined
          ? body.homeChatId.trim()
          : current.homeChatId,
      replyInThread:
        body.replyInThread !== undefined
          ? Boolean(body.replyInThread)
          : current.replyInThread,
      aiResponseTimeoutMs:
        body.aiResponseTimeoutMs !== undefined
          ? normalizeFeishuAiResponseTimeoutMs(body.aiResponseTimeoutMs)
          : current.aiResponseTimeoutMs,
      lastError: null,
    };

    const needsEncryption =
      (body.appSecret !== undefined && body.appSecret) ||
      (body.encryptKey !== undefined && body.encryptKey);
    if (needsEncryption && !secret) {
      return c.json({ error: "服务端未配置加密密钥，无法保存凭证" }, 500);
    }

    await upsertSetting(
      db,
      FEISHU_SETTING_KEYS.config,
      serializeFeishuConfig(next)
    );

    if (body.appSecret !== undefined) {
      const value = body.appSecret?.trim() ?? "";
      if (value) {
        const encrypted = await encryptSettingSecret(value, secret!);
        await upsertSetting(db, FEISHU_SETTING_KEYS.appSecret, encrypted);
      } else {
        await deleteSetting(db, FEISHU_SETTING_KEYS.appSecret);
      }
      clearTenantAccessTokenCache();
    }

    if (body.encryptKey !== undefined) {
      const value = body.encryptKey?.trim() ?? "";
      if (value) {
        const encrypted = await encryptSettingSecret(value, secret!);
        await upsertSetting(db, FEISHU_SETTING_KEYS.encryptKey, encrypted);
      } else {
        await deleteSetting(db, FEISHU_SETTING_KEYS.encryptKey);
      }
    }

    const runtime = await loadFeishuRuntime(db, secret ?? "");
    const urls = resolveWebhookUrls(c, options);
    return c.json(
      buildFeishuConfigPublic(
        runtime.config,
        runtime.hasAppSecret,
        runtime.hasEncryptKey,
        urls.eventWebhookUrl,
        urls.callbackWebhookUrl
      ) satisfies FeishuConfigPublic
    );
  });

  routes.post("/feishu/test", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const secret = options.getSecret?.(c) ?? "";
    const runtime = await loadFeishuRuntime(db, secret);
    if (!runtime.config.appId || !runtime.secrets.appSecret) {
      return c.json({ error: "请先配置 App ID 与 App Secret" }, 400);
    }

    const authorOpenId = runtime.config.authorOpenIds[session.userId]?.trim() ?? "";

    try {
      await testFeishuConnection({
        appId: runtime.config.appId,
        appSecret: runtime.secrets.appSecret,
        homeChatId: runtime.config.homeChatId,
        authorOpenId,
      });
      const updated: FeishuConfigStored = {
        ...runtime.config,
        lastError: null,
        lastConnectedAt: Math.floor(Date.now() / 1000),
      };
      await upsertSetting(
        db,
        FEISHU_SETTING_KEYS.config,
        serializeFeishuConfig(updated)
      );
      return c.json({ ok: true });
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "飞书连接测试失败";
      const updated: FeishuConfigStored = {
        ...runtime.config,
        lastError: message,
      };
      await upsertSetting(
        db,
        FEISHU_SETTING_KEYS.config,
        serializeFeishuConfig(updated)
      );
      return c.json({ error: message }, 422);
    }
  });

  routes.post("/feishu/events", async (c) => {
    const rawBody = await c.req.text();
    const db = await getDb(c);
    const secret = options.getSecret?.(c) ?? "";
    const runtime = await loadFeishuRuntime(db, secret);

    return handleLarkInboundWebhook(c, rawBody, runtime, async (payload) => {
      scheduleBackground(
        c,
        options,
        handleLarkEvent(c, db, options, payload as LarkEventEnvelope).catch(
          (err) => {
            log.error("event handling failed", err);
          }
        )
      );
      return { ok: true };
    });
  });

  routes.post("/feishu/callbacks", async (c) => {
    const rawBody = await c.req.text();
    const db = await getDb(c);
    const secret = options.getSecret?.(c) ?? "";
    const runtime = await loadFeishuRuntime(db, secret);
    const baseUrl =
      options.getWebhookBaseUrl?.(c)?.replace(/\/$/, "") ??
      new URL(c.req.url).origin;

    return handleLarkInboundWebhook(c, rawBody, runtime, async (payload) =>
      handleFeishuCallback(payload, {
        db,
        baseUrl,
        config: runtime.config,
        appId: runtime.config.appId,
        appSecret: runtime.secrets.appSecret,
        aiEnv: options.getAiEnv?.(c),
        scheduleBackground: (task) => scheduleBackground(c, options, task),
      })
    );
  });

  return routes;
}
