import { Hono } from "hono";
import type { Context } from "hono";
import {
  ACCENT_PRESETS,
  AI_PROVIDERS,
  APP_SETTING_KEYS,
  buildAppSettings,
  isAccentPreset,
  isAiProvider,
  type AppSettings,
} from "../app-settings.js";
import {
  deleteSetting,
  readSettingsMap,
  upsertSetting,
} from "../db/settings-store.js";
import { getRequestId } from "../lib/request-context.js";
import { createLogger } from "../lib/logger.js";
import { encryptSettingSecret } from "../lib/secret-crypto.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/audit.js";
import type { SessionAuthor } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("settings");

export interface SettingsRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getSecret?: (c: Context) => string | undefined;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: SettingsRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) {
    return c.json({ error: "账号身份无效，请使用「小圆子」或「小麟子」注册/登录" }, 400);
  }
  return sessionAuthor;
}

interface SettingsPutBody {
  accentPreset?: string;
  aiProvider?: string;
  aiModel?: string | null;
  openaiKey?: string | null;
  anthropicKey?: string | null;
  deepseekKey?: string | null;
}

async function persistSettings(
  db: any,
  session: SessionAuthor,
  c: Context,
  metadata: Record<string, unknown>
): Promise<AppSettings> {
  const map = await readSettingsMap(db);
  const settings = buildAppSettings(map);
  await recordAudit(db, {
    userId: session.userId,
    author: session.author,
    action: AuditAction.SETTINGS_UPDATE,
    resourceType: AuditResourceType.SETTINGS,
    resourceId: "settings",
    metadata,
    requestId: getRequestId(c),
  });
  return settings;
}

export function createSettingsRoutes(
  getDb: DbProvider,
  options: SettingsRouteOptions = {}
) {
  const settingsRoutes = new Hono();

  settingsRoutes.get("/", async (c) => {
    const db = await getDb(c);
    try {
      const map = await readSettingsMap(db);
      return c.json(buildAppSettings(map) satisfies AppSettings);
    } catch (err) {
      log.error("read failed", err);
      return c.json({ error: "无法读取设置" }, 500);
    }
  });

  settingsRoutes.put("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: SettingsPutBody;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const hasUpdates =
      body.accentPreset !== undefined ||
      body.aiProvider !== undefined ||
      body.aiModel !== undefined ||
      body.openaiKey !== undefined ||
      body.anthropicKey !== undefined ||
      body.deepseekKey !== undefined;

    if (!hasUpdates) {
      try {
        const db = await getDb(c);
        const map = await readSettingsMap(db);
        return c.json(buildAppSettings(map) satisfies AppSettings);
      } catch (err) {
        log.error("read failed after noop put", err);
        return c.json({ error: "设置保存失败" }, 500);
      }
    }

    const db = await getDb(c);
    const auditMetadata: Record<string, unknown> = {};
    let settingsMap = await readSettingsMap(db);

    try {
      if (body.accentPreset !== undefined) {
        if (!isAccentPreset(body.accentPreset)) {
          return c.json(
            { error: `主题色无效，可选：${ACCENT_PRESETS.join("、")}` },
            400
          );
        }
        await upsertSetting(db, APP_SETTING_KEYS.accentPreset, body.accentPreset);
        auditMetadata.accentPreset = body.accentPreset;
      }

      if (body.aiProvider !== undefined) {
        if (!isAiProvider(body.aiProvider)) {
          return c.json(
            { error: `AI 提供商无效，可选：${AI_PROVIDERS.join("、")}` },
            400
          );
        }
        const previousProvider = settingsMap[APP_SETTING_KEYS.aiProvider]?.trim();
        await upsertSetting(db, APP_SETTING_KEYS.aiProvider, body.aiProvider);
        auditMetadata.aiProvider = body.aiProvider;

        if (
          body.aiModel === undefined &&
          previousProvider &&
          isAiProvider(previousProvider) &&
          previousProvider !== body.aiProvider
        ) {
          await deleteSetting(db, APP_SETTING_KEYS.aiModel);
          auditMetadata.aiModel = null;
          delete settingsMap[APP_SETTING_KEYS.aiModel];
        }
        settingsMap[APP_SETTING_KEYS.aiProvider] = body.aiProvider;
      }

      if (body.aiModel !== undefined) {
        const model = body.aiModel?.trim() ?? "";
        if (model) {
          await upsertSetting(db, APP_SETTING_KEYS.aiModel, model);
          auditMetadata.aiModel = model;
        } else {
          await deleteSetting(db, APP_SETTING_KEYS.aiModel);
          auditMetadata.aiModel = null;
        }
      }

      const secret = options.getSecret?.(c);
      const needsEncryption =
        (body.openaiKey !== undefined ||
          body.anthropicKey !== undefined ||
          body.deepseekKey !== undefined) &&
        (body.openaiKey || body.anthropicKey || body.deepseekKey);

      if (needsEncryption && !secret) {
        return c.json({ error: "服务端未配置加密密钥，无法保存 API Key" }, 500);
      }

      if (body.openaiKey !== undefined) {
        const key = body.openaiKey?.trim() ?? "";
        if (key) {
          const encrypted = await encryptSettingSecret(key, secret!);
          await upsertSetting(db, APP_SETTING_KEYS.aiOpenaiKey, encrypted);
          auditMetadata.openaiKey = "updated";
        } else {
          await deleteSetting(db, APP_SETTING_KEYS.aiOpenaiKey);
          auditMetadata.openaiKey = "cleared";
        }
      }

      if (body.anthropicKey !== undefined) {
        const key = body.anthropicKey?.trim() ?? "";
        if (key) {
          const encrypted = await encryptSettingSecret(key, secret!);
          await upsertSetting(db, APP_SETTING_KEYS.aiAnthropicKey, encrypted);
          auditMetadata.anthropicKey = "updated";
        } else {
          await deleteSetting(db, APP_SETTING_KEYS.aiAnthropicKey);
          auditMetadata.anthropicKey = "cleared";
        }
      }

      if (body.deepseekKey !== undefined) {
        const key = body.deepseekKey?.trim() ?? "";
        if (key) {
          const encrypted = await encryptSettingSecret(key, secret!);
          await upsertSetting(db, APP_SETTING_KEYS.aiDeepseekKey, encrypted);
          auditMetadata.deepseekKey = "updated";
        } else {
          await deleteSetting(db, APP_SETTING_KEYS.aiDeepseekKey);
          auditMetadata.deepseekKey = "cleared";
        }
      }

      const settings = await persistSettings(db, session, c, auditMetadata);
      return c.json(settings satisfies AppSettings);
    } catch (err) {
      log.error("write failed", err);
      return c.json({ error: "设置保存失败" }, 500);
    }
  });

  return settingsRoutes;
}
