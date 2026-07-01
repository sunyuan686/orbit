import { Hono } from "hono";
import type { Context } from "hono";
import {
  buildFeishuConfigPublic,
  FEISHU_SETTING_KEYS,
  loadFeishuRuntime,
  parseFeishuConfig,
  serializeFeishuConfig,
  type FeishuConfigPublic,
  type FeishuConfigStored,
} from "../services/feishu-settings.js";
import {
  decryptLarkPayload,
  verifyLarkSignature,
} from "../services/feishu-crypto.js";
import {
  clearTenantAccessTokenCache,
  testFeishuConnection,
} from "../services/feishu-api.js";
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

interface FeishuPutBody {
  enabled?: boolean;
  appId?: string;
  appSecret?: string | null;
  encryptKey?: string | null;
  verificationToken?: string;
  authorOpenIds?: { 小圆子?: string; 小麟子?: string };
  allowedGroupChatIds?: string[];
  mergeWindowMs?: number;
  homeChatId?: string;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: IntegrationsRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) {
    return c.json({ error: "账号身份无效，请使用「小圆子」或「小麟子」注册/登录" }, 400);
  }
  return sessionAuthor;
}

function resolveWebhookUrl(c: Context, options: IntegrationsRouteOptions): string {
  const base = options.getWebhookBaseUrl?.(c) ?? new URL(c.req.url).origin;
  return `${base.replace(/\/$/, "")}/api/integrations/feishu/events`;
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

interface LarkEventEnvelope {
  challenge?: string;
  token?: string;
  type?: string;
  encrypt?: string;
  schema?: string;
  header?: {
    event_type?: string;
    event_id?: string;
  };
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

async function parseLarkEventBody(
  rawBody: string,
  encryptKey: string
): Promise<LarkEventEnvelope> {
  const outer = JSON.parse(rawBody) as LarkEventEnvelope;
  if (outer.encrypt && encryptKey) {
    const decrypted = await decryptLarkPayload(outer.encrypt, encryptKey);
    return JSON.parse(decrypted) as LarkEventEnvelope;
  }
  return outer;
}

async function handleLarkEvent(
  c: Context,
  db: any,
  options: IntegrationsRouteOptions,
  payload: LarkEventEnvelope
): Promise<void> {
  if (payload.type === "url_verification" && payload.challenge) {
    return;
  }

  const eventType = payload.header?.event_type;
  if (eventType !== "im.message.receive_v1" || !payload.event?.message) {
    return;
  }

  const runtime = await loadFeishuRuntime(db, options.getSecret?.(c) ?? "");
  if (!runtime.config.enabled) return;

  const message = payload.event.message;
  const senderOpenId = payload.event.sender?.sender_id?.open_id?.trim() ?? "";
  const messageId = message.message_id?.trim() ?? "";
  const chatId = message.chat_id?.trim() ?? "";
  if (!messageId || !chatId || !senderOpenId) return;

  if (!runtime.secrets.appSecret || !runtime.config.appId) return;

  const claimed = await tryClaimFeishuMessage(db, messageId);
  if (!claimed) return;

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
      chatType: message.chat_type ?? "p2p",
      messageType: message.message_type ?? "text",
      content: message.content ?? "",
      senderOpenId,
    },
    { hasGroupMention: Boolean(message.mentions?.length) }
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
    return c.json(
      buildFeishuConfigPublic(
        runtime.config,
        runtime.hasAppSecret,
        runtime.hasEncryptKey,
        resolveWebhookUrl(c, options)
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
      authorOpenIds: {
        小圆子:
          body.authorOpenIds?.小圆子 !== undefined
            ? body.authorOpenIds.小圆子.trim()
            : current.authorOpenIds.小圆子,
        小麟子:
          body.authorOpenIds?.小麟子 !== undefined
            ? body.authorOpenIds.小麟子.trim()
            : current.authorOpenIds.小麟子,
      },
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
    return c.json(
      buildFeishuConfigPublic(
        runtime.config,
        runtime.hasAppSecret,
        runtime.hasEncryptKey,
        resolveWebhookUrl(c, options)
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

    const authorOpenId =
      session.author === "小圆子"
        ? runtime.config.authorOpenIds.小圆子
        : runtime.config.authorOpenIds.小麟子;

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

    if (runtime.secrets.encryptKey) {
      const timestamp = c.req.header("X-Lark-Request-Timestamp") ?? "";
      const nonce = c.req.header("X-Lark-Request-Nonce") ?? "";
      const signature = c.req.header("X-Lark-Signature") ?? "";
      const valid = await verifyLarkSignature(
        timestamp,
        nonce,
        runtime.secrets.encryptKey,
        rawBody,
        signature
      );
      if (!valid) {
        return c.json({ error: "invalid signature" }, 401);
      }
    }

    let payload: LarkEventEnvelope;
    try {
      payload = await parseLarkEventBody(rawBody, runtime.secrets.encryptKey);
    } catch (err) {
      log.error("parse event failed", err);
      return c.json({ error: "invalid payload" }, 400);
    }

    if (payload.type === "url_verification" && payload.challenge) {
      if (
        runtime.config.verificationToken &&
        payload.token !== runtime.config.verificationToken
      ) {
        return c.json({ error: "invalid token" }, 401);
      }
      return c.json({ challenge: payload.challenge });
    }

    if (
      runtime.config.verificationToken &&
      payload.token &&
      payload.token !== runtime.config.verificationToken
    ) {
      return c.json({ error: "invalid token" }, 401);
    }

    scheduleBackground(
      c,
      options,
      handleLarkEvent(c, db, options, payload).catch((err) => {
        log.error("event handling failed", err);
      })
    );

    return c.json({ ok: true });
  });

  return routes;
}
