import { Hono } from "hono";
import type { Context } from "hono";
import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { notification, user, pushSubscription } from "../db/schema.js";
import {
  parseNotificationPreferences,
  serializeNotificationPreferences,
  type NotificationPreferences,
} from "../services/notify/notification-settings.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";
import { generateId } from "../lib/id.js";

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
    const userRow = await db
      .select({ notificationPreferences: user.notificationPreferences })
      .from(user)
      .where(eq(user.id, session.userId))
      .get();
    return c.json(
      parseNotificationPreferences(userRow?.notificationPreferences)
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
    const userRow = await db
      .select({ notificationPreferences: user.notificationPreferences })
      .from(user)
      .where(eq(user.id, session.userId))
      .get();
    const current = parseNotificationPreferences(userRow?.notificationPreferences);
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
    await db
      .update(user)
      .set({
        notificationPreferences: serializeNotificationPreferences(next),
        updatedAt: new Date(),
      })
      .where(eq(user.id, session.userId));
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

  // Web Push 订阅注册
  routes.post("/push-subscription", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { endpoint: string; p256dh: string; auth: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }
    if (!body.endpoint || !body.p256dh || !body.auth) {
      return c.json({ error: "缺少必要字段" }, 400);
    }

    const db = await getDb(c);
    const id = generateId("psh");
    const createdAt = Math.floor(Date.now() / 1000);
    await db
      .insert(pushSubscription)
      .values({ id, userId: session.userId, endpoint: body.endpoint, p256dh: body.p256dh, auth: body.auth, createdAt })
      .onConflictDoUpdate({
        target: pushSubscription.endpoint,
        set: { userId: session.userId, p256dh: body.p256dh, auth: body.auth },
      });
    return c.json({ ok: true });
  });

  // Web Push 订阅注销
  routes.delete("/push-subscription", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { endpoint: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }
    if (!body.endpoint) return c.json({ error: "缺少 endpoint" }, 400);

    const db = await getDb(c);
    await db
      .delete(pushSubscription)
      .where(
        and(
          eq(pushSubscription.userId, session.userId),
          eq(pushSubscription.endpoint, body.endpoint)
        )
      );
    return c.json({ ok: true });
  });

  return routes;
}
