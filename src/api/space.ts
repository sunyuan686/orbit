import { Hono } from "hono";
import type { Context } from "hono";
import {
  SPACE_SETTING_KEYS,
  buildSpaceProfile,
  formatAnniversaryForStorage,
  normalizeSlogan,
  parseAnniversaryToIso,
  type SpaceProfile,
} from "../space-profile.js";
import { readSettingsMap, upsertSetting } from "../db/settings-store.js";
import { getRequestId } from "../lib/request-context.js";
import { createLogger } from "../lib/logger.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/space/audit.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";
import { buildSpaceStatus } from "./invite.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("space");

export interface SpaceRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: SpaceRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) {
    return c.json({ error: INVALID_SESSION_ERROR }, 400);
  }
  return sessionAuthor;
}

export function createSpaceRoutes(
  getDb: DbProvider,
  options: SpaceRouteOptions = {}
) {
  const space = new Hono();

  space.get("/status", async (c) => {
    const db = await getDb(c);
    return c.json(await buildSpaceStatus(db));
  });

  space.get("/", async (c) => {
    const db = await getDb(c);
    try {
      const map = await readSettingsMap(db);
      const profile = buildSpaceProfile(map);
      return c.json(profile satisfies SpaceProfile);
    } catch (err) {
      log.error("read failed", err);
      return c.json({ error: "无法读取空间档案" }, 500);
    }
  });

  space.put("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { anniversaryDate?: string | null; slogan?: string | null };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const db = await getDb(c);
    const changedFields: string[] = [];

    if (body.anniversaryDate !== undefined) {
      if (body.anniversaryDate === null || body.anniversaryDate === "") {
        await upsertSetting(db, SPACE_SETTING_KEYS.anniversaryDate, "");
      } else {
        const iso = parseAnniversaryToIso(body.anniversaryDate);
        if (!iso) {
          return c.json({ error: "纪念日格式无效" }, 400);
        }
        const stored = formatAnniversaryForStorage(iso);
        if (!stored) {
          return c.json({ error: "纪念日格式无效" }, 400);
        }
        await upsertSetting(db, SPACE_SETTING_KEYS.anniversaryDate, stored);
      }
      changedFields.push("anniversaryDate");
    }

    if (body.slogan !== undefined) {
      const slogan = normalizeSlogan(body.slogan);
      if (slogan && slogan.length > 80) {
        return c.json({ error: "一句话不能超过 80 字" }, 400);
      }
      await upsertSetting(db, SPACE_SETTING_KEYS.slogan, slogan ?? "");
      changedFields.push("slogan");
    }

    try {
      const map = await readSettingsMap(db);
      const profile = buildSpaceProfile(map);
      if (changedFields.length > 0) {
        await recordAudit(db, {
          userId: session.userId,
          author: session.author,
          action: AuditAction.SPACE_UPDATE,
          resourceType: AuditResourceType.SPACE,
          resourceId: "space",
          metadata: { changedFields },
          requestId: getRequestId(c),
        });
      }
      return c.json(profile satisfies SpaceProfile);
    } catch (err) {
      log.error("write failed", err);
      return c.json({ error: "空间档案保存失败" }, 500);
    }
  });

  return space;
}
