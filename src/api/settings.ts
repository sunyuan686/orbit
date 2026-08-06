import { Hono } from "hono";
import type { Context } from "hono";
import {
  ACCENT_PRESETS,
  AI_PROVIDERS,
  APP_SETTING_KEYS,
  buildAppSettings,
  inferAiProviderFromModelId,
  isAccentPreset,
  isAiProvider,
  parseAiConnections,
  serializeAiConnections,
  serializeAiEnabledModels,
  serializeAiEnabledProviders,
  type AiProvider,
  type AppSettings,
} from "../app-settings.js";
import {
  connectionKeySettingId,
  normalizeEnabledModelRef,
  validateAiConnections,
} from "../services/ai-connections.js";
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
  aiEnabledModels?: string[];
  aiEnabledProviders?: string[];
  aiConnections?: Array<{
    id: string;
    name: string;
    baseUrl: string;
    models: Array<{ id: string; label?: string }>;
    enabled?: boolean;
  }>;
  connectionKey?: { id: string; key: string | null };
  deepseekKey?: string | null;
  alibabaKey?: string | null;
  aiBotName?: string;
  aiBotPersona?: string;
}

async function persistSettings(
  db: any,
  session: SessionAuthor,
  c: Context,
  metadata: Record<string, unknown>
): Promise<AppSettings> {
  const map = await readSettingsMap(db);
  const env = (c.env as any) ?? process.env;
  const settings = buildAppSettings(map, env);
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
      const env = (c.env as any) ?? process.env;
      return c.json(buildAppSettings(map, env) satisfies AppSettings);
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
      body.aiEnabledModels !== undefined ||
      body.aiEnabledProviders !== undefined ||
      body.aiConnections !== undefined ||
      body.connectionKey !== undefined ||
      body.deepseekKey !== undefined ||
      body.alibabaKey !== undefined ||
      body.aiBotName !== undefined ||
      body.aiBotPersona !== undefined;

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
          const inferredProvider = inferAiProviderFromModelId(model);
          const currentProvider =
            settingsMap[APP_SETTING_KEYS.aiProvider]?.trim();
          if (
            !currentProvider ||
            !isAiProvider(currentProvider) ||
            currentProvider !== inferredProvider
          ) {
            await upsertSetting(
              db,
              APP_SETTING_KEYS.aiProvider,
              inferredProvider
            );
            auditMetadata.aiProvider = inferredProvider;
            settingsMap[APP_SETTING_KEYS.aiProvider] = inferredProvider;
          }
        } else {
          await deleteSetting(db, APP_SETTING_KEYS.aiModel);
          auditMetadata.aiModel = null;
        }
      }

      if (body.aiEnabledModels !== undefined) {
        if (!Array.isArray(body.aiEnabledModels)) {
          return c.json({ error: "aiEnabledModels 必须是字符串数组" }, 400);
        }
        const ids = body.aiEnabledModels
          .filter((id): id is string => typeof id === "string")
          .map((id) => normalizeEnabledModelRef(id))
          .filter((id): id is string => Boolean(id));
        if (ids.length > 64) {
          return c.json({ error: "启用的模型数量过多" }, 400);
        }
        if (ids.length === 0) {
          return c.json({ error: "至少保留一个可用模型" }, 400);
        }
        const serialized = serializeAiEnabledModels(ids);
        await upsertSetting(db, APP_SETTING_KEYS.aiEnabledModels, serialized);
        auditMetadata.aiEnabledModels = ids;
      }

      if (body.aiEnabledProviders !== undefined) {
        if (!Array.isArray(body.aiEnabledProviders)) {
          return c.json({ error: "aiEnabledProviders 必须是字符串数组" }, 400);
        }
        const ids = body.aiEnabledProviders
          .filter((id): id is string => typeof id === "string")
          .map((id) => id.trim())
          .filter(
            (id): id is "workers-ai" | "deepseek" | "alibaba" =>
              id === "workers-ai" || id === "deepseek" || id === "alibaba"
          );
        if (ids.length === 0) {
          return c.json({ error: "至少保留一个内置供应商" }, 400);
        }
        const serialized = serializeAiEnabledProviders(ids);
        await upsertSetting(db, APP_SETTING_KEYS.aiEnabledProviders, serialized);
        auditMetadata.aiEnabledProviders = ids;
      }

      if (body.aiConnections !== undefined) {
        if (!Array.isArray(body.aiConnections)) {
          return c.json({ error: "aiConnections 必须是数组" }, 400);
        }
        const connections = parseAiConnections(
          JSON.stringify(body.aiConnections)
        );
        const validationError = validateAiConnections(connections);
        if (validationError) {
          return c.json({ error: validationError }, 400);
        }

        const previous = parseAiConnections(
          settingsMap[APP_SETTING_KEYS.aiConnections]
        );
        const nextIds = new Set(connections.map((connection) => connection.id));
        for (const connection of previous) {
          if (!nextIds.has(connection.id)) {
            await deleteSetting(db, connectionKeySettingId(connection.id));
            auditMetadata[`connectionKey:${connection.id}`] = "cleared";
          }
        }

        await upsertSetting(
          db,
          APP_SETTING_KEYS.aiConnections,
          serializeAiConnections(connections)
        );
        auditMetadata.aiConnections = connections.map((connection) => connection.id);
        settingsMap[APP_SETTING_KEYS.aiConnections] =
          serializeAiConnections(connections);
      }

      const secret = options.getSecret?.(c);
      const needsEncryption =
        (body.deepseekKey !== undefined || body.alibabaKey !== undefined || body.connectionKey !== undefined) &&
        (body.deepseekKey || body.alibabaKey || body.connectionKey?.key);

      if (needsEncryption && !secret) {
        return c.json({ error: "服务端未配置加密密钥，无法保存 API Key" }, 500);
      }

      if (body.connectionKey !== undefined) {
        const connectionId = body.connectionKey.id?.trim() ?? "";
        if (!connectionId) {
          return c.json({ error: "connectionKey.id 无效" }, 400);
        }
        const connections = parseAiConnections(
          settingsMap[APP_SETTING_KEYS.aiConnections]
        );
        if (!connections.some((connection) => connection.id === connectionId)) {
          return c.json({ error: "连接不存在" }, 400);
        }

        const key = body.connectionKey.key?.trim() ?? "";
        if (key) {
          const encrypted = await encryptSettingSecret(key, secret!);
          await upsertSetting(db, connectionKeySettingId(connectionId), encrypted);
          auditMetadata[`connectionKey:${connectionId}`] = "updated";
        } else {
          await deleteSetting(db, connectionKeySettingId(connectionId));
          auditMetadata[`connectionKey:${connectionId}`] = "cleared";
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

      if (body.alibabaKey !== undefined) {
        const key = body.alibabaKey?.trim() ?? "";
        if (key) {
          const encrypted = await encryptSettingSecret(key, secret!);
          await upsertSetting(db, APP_SETTING_KEYS.aiAlibabaKey, encrypted);
          await upsertSetting(db, "ai_key_dashscope", encrypted);
          auditMetadata.alibabaKey = "updated";
        } else {
          await deleteSetting(db, APP_SETTING_KEYS.aiAlibabaKey);
          await deleteSetting(db, "ai_key_dashscope");
          auditMetadata.alibabaKey = "cleared";
        }
      }

      if (body.aiBotName !== undefined) {
        const name = body.aiBotName.trim();
        await upsertSetting(db, APP_SETTING_KEYS.aiBotName, name);
        auditMetadata.aiBotName = name;
      }

      if (body.aiBotPersona !== undefined) {
        const persona = body.aiBotPersona.trim();
        await upsertSetting(db, APP_SETTING_KEYS.aiBotPersona, persona);
        auditMetadata.aiBotPersona = persona;
      }

      const settings = await persistSettings(db, session, c, auditMetadata);
      return c.json(settings satisfies AppSettings);
    } catch (err) {
      log.error("write failed", err);
      return c.json({ error: "设置保存失败" }, 500);
    }
  });

  // ─── Companion 陪伴设置 ──────────────────────────────────────────────────────

  /** GET /api/settings/companion — 读取陪伴推送配置 */
  settingsRoutes.get("/companion", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;
    const db = getDb(c);
    const map = await readSettingsMap(db);
    let nextAlarmAt: number | null = null;
    try {
      const scheduler = (c.env as any).COMPANION_SCHEDULER?.getByName("companion");
      if (scheduler) {
        const result = await scheduler.status();
        nextAlarmAt = result.nextAlarmAt;
      }
    } catch {
      // 状态读取失败不影响配置展示
    }
    return c.json({
      quietStart:    map["companion_quiet_start"]    ?? "22:30",
      quietEnd:      map["companion_quiet_end"]      ?? "08:30",
      pushStart:     map["companion_push_start"]     ?? "09:00",
      pushEnd:       map["companion_push_end"]       ?? "21:30",
      preferredTime: map["companion_preferred_time"] ?? "09:00",
      enabled:       map["companion_enabled"]         !== "false",
      nextAlarmAt,
    });
  });

  /** PUT /api/settings/companion — 写入陪伴推送配置，自动触发 reschedule */
  settingsRoutes.put("/companion", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const body = await c.req.json<{
      quietStart?: string;
      quietEnd?: string;
      pushStart?: string;
      pushEnd?: string;
      preferredTime?: string;
      enabled?: boolean;
    }>();

    // HH:MM 格式校验
    const timeRe = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (body.quietStart !== undefined && !timeRe.test(body.quietStart)) {
      return c.json({ error: "quietStart 格式应为 HH:MM" }, 400);
    }
    if (body.quietEnd !== undefined && !timeRe.test(body.quietEnd)) {
      return c.json({ error: "quietEnd 格式应为 HH:MM" }, 400);
    }
    if (body.pushStart !== undefined && !timeRe.test(body.pushStart)) {
      return c.json({ error: "pushStart 格式应为 HH:MM" }, 400);
    }
    if (body.pushEnd !== undefined && !timeRe.test(body.pushEnd)) {
      return c.json({ error: "pushEnd 格式应为 HH:MM" }, 400);
    }
    if (body.preferredTime !== undefined && !timeRe.test(body.preferredTime)) {
      return c.json({ error: "preferredTime 格式应为 HH:MM" }, 400);
    }

    const db = getDb(c);
    if (body.quietStart !== undefined) {
      await upsertSetting(db, "companion_quiet_start", body.quietStart);
    }
    if (body.quietEnd !== undefined) {
      await upsertSetting(db, "companion_quiet_end", body.quietEnd);
    }
    if (body.pushStart !== undefined) {
      await upsertSetting(db, "companion_push_start", body.pushStart);
    }
    if (body.pushEnd !== undefined) {
      await upsertSetting(db, "companion_push_end", body.pushEnd);
    }
    if (body.preferredTime !== undefined) {
      await upsertSetting(db, "companion_preferred_time", body.preferredTime);
    }
    if (body.enabled !== undefined) {
      await upsertSetting(db, "companion_enabled", body.enabled ? "true" : "false");
    }

    // 配置变更后立即 reschedule DO Alarm
    let nextAlarmAt: number | null = null;
    try {
      const scheduler = (c.env as any).COMPANION_SCHEDULER?.getByName("companion");
      if (scheduler) {
        const result = await scheduler.reschedule();
        nextAlarmAt = result.nextAlarmAt;
      }
    } catch {
      // reschedule 失败不影响配置保存
    }

    await recordAudit(db, {
      userId: session.userId,
      author: session.author,
      action: AuditAction.SETTINGS_UPDATE,
      resourceType: AuditResourceType.SETTINGS,
      resourceId: "companion",
      metadata: {
        quietStart: body.quietStart,
        quietEnd: body.quietEnd,
        pushStart: body.pushStart,
        pushEnd: body.pushEnd,
        preferredTime: body.preferredTime,
        enabled: body.enabled,
      },
      requestId: getRequestId(c),
    });

    const map = await readSettingsMap(db);
    return c.json({
      quietStart:    map["companion_quiet_start"]    ?? "22:30",
      quietEnd:      map["companion_quiet_end"]      ?? "08:30",
      pushStart:     map["companion_push_start"]     ?? "09:00",
      pushEnd:       map["companion_push_end"]       ?? "21:30",
      preferredTime: map["companion_preferred_time"] ?? "09:00",
      enabled:       map["companion_enabled"]         !== "false",
      nextAlarmAt,
    });
  });

  return settingsRoutes;
}
