import { Hono } from "hono";
import type { Context } from "hono";
import {
  ACCENT_PRESETS,
  APP_SETTING_KEYS,
  buildAppSettings,
  isAccentPreset,
  type AppSettings,
} from "../app-settings.js";
import { readSettingsMap, upsertSetting } from "../db/settings-store.js";
import { getRequestId } from "../lib/request-context.js";
import { createLogger } from "../lib/logger.js";
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

    let body: { accentPreset?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    if (body.accentPreset !== undefined) {
      if (!isAccentPreset(body.accentPreset)) {
        return c.json(
          { error: `主题色无效，可选：${ACCENT_PRESETS.join("、")}` },
          400
        );
      }
      const db = await getDb(c);
      await upsertSetting(db, APP_SETTING_KEYS.accentPreset, body.accentPreset);

      try {
        const map = await readSettingsMap(db);
        const settings = buildAppSettings(map);
        await recordAudit(db, {
          userId: session.userId,
          author: session.author,
          action: AuditAction.SETTINGS_UPDATE,
          resourceType: AuditResourceType.SETTINGS,
          resourceId: "settings",
          metadata: { accentPreset: settings.accentPreset },
          requestId: getRequestId(c),
        });
        return c.json(settings satisfies AppSettings);
      } catch (err) {
        log.error("write failed", err);
        return c.json({ error: "设置保存失败" }, 500);
      }
    }

    try {
      const db = await getDb(c);
      const map = await readSettingsMap(db);
      const settings = buildAppSettings(map);
      return c.json(settings satisfies AppSettings);
    } catch (err) {
      log.error("read failed after noop put", err);
      return c.json({ error: "设置保存失败" }, 500);
    }
  });

  return settingsRoutes;
}
