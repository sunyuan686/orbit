import { Hono } from "hono";
import type { Context } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notification } from "../db/schema.js";
import {
  NOTIFICATION_SETTING_KEY,
  parseNotificationPreferences,
  serializeNotificationPreferences,
  type NotificationPreferences,
} from "../services/notification-settings.js";
import { readSettingsMap, upsertSetting } from "../db/settings-store.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface NotificationsRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: NotificationsRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) {
    return c.json({ error: INVALID_SESSION_ERROR }, 400);
  }
  return sessionAuthor;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function mapNotification(row: {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  actor: string;
  title: string;
  body: string;
  link: string;
  readAt: number | null;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: row.id,
    type: row.type,
    targetType: row.targetType,
    targetId: row.targetId,
    actor: row.actor,
    title: row.title,
    body: row.body,
    link: row.link,
    readAt: row.readAt,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createNotificationsRoutes(
  getDb: DbProvider,
  options: NotificationsRouteOptions = {}
) {
  const routes = new Hono();

  routes.get("/preferences", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;
    const db = await getDb(c);
    const map = await readSettingsMap(db);
    return c.json(
      parseNotificationPreferences(map[NOTIFICATION_SETTING_KEY])
    );
  });

  routes.put("/preferences", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: Partial<NotificationPreferences>;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const db = await getDb(c);
    const current = parseNotificationPreferences(
      (await readSettingsMap(db))[NOTIFICATION_SETTING_KEY]
    );
    const next = parseNotificationPreferences(
      JSON.stringify({
        ...current,
        ...body,
        events: {
          ...current.events,
          ...(body.events ?? {}),
        },
      })
    );
    await upsertSetting(
      db,
      NOTIFICATION_SETTING_KEY,
      serializeNotificationPreferences(next)
    );
    return c.json(next);
  });

  routes.get("/unread-count", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;
    const db = await getDb(c);
    const row = await db
      .select({ count: sql<number>`count(*)` })
      .from(notification)
      .where(
        and(
          eq(notification.recipientUserId, session.userId),
          isNull(notification.readAt)
        )
      )
      .get();
    return c.json({ count: row?.count ?? 0 });
  });

  routes.get("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;
    const db = await getDb(c);
    const limit = Math.min(Number(c.req.query("limit") ?? 30), 50);
    const rows = await db
      .select()
      .from(notification)
      .where(eq(notification.recipientUserId, session.userId))
      .orderBy(desc(notification.createdAt))
      .limit(limit);
    return c.json(rows.map(mapNotification));
  });

  routes.put("/read-all", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;
    const db = await getDb(c);
    const timestamp = now();
    await db
      .update(notification)
      .set({ readAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(notification.recipientUserId, session.userId),
          isNull(notification.readAt)
        )
      );
    return c.json({ ok: true });
  });

  routes.put("/read/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;
    const db = await getDb(c);
    const id = c.req.param("id");
    const timestamp = now();
    await db
      .update(notification)
      .set({ readAt: timestamp, updatedAt: timestamp })
      .where(
        and(
          eq(notification.id, id),
          eq(notification.recipientUserId, session.userId),
          isNull(notification.readAt)
        )
      );
    return c.json({ ok: true });
  });

  return routes;
}
