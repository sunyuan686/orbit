import { Hono } from "hono";
import type { Context } from "hono";
import { and, desc, eq, isNull, gt } from "drizzle-orm";
import { spaceInvite } from "../db/schema.js";
import {
  countUsers,
  getSpaceAuthors,
  MAX_SPACE_USERS,
} from "../services/space/space-authors.js";
import { createSpaceUser } from "../services/space/user-signup.js";
import { recordAudit } from "../services/space/audit.js";
import { getRequestId } from "../lib/request-context.js";
import { generateId } from "../lib/id.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

const INVITE_TTL_SECONDS = 7 * 24 * 60 * 60;

type DbProvider = (c: Context) => any | Promise<any>;

export interface InviteRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getBaseUrl?: (c: Context) => string;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: InviteRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return c.json({ error: INVALID_SESSION_ERROR }, 400);
  return sessionAuthor;
}

async function invalidateActiveInvites(db: any, timestamp: number): Promise<void> {
  await db
    .update(spaceInvite)
    .set({ usedAt: timestamp, updatedAt: timestamp })
    .where(and(isNull(spaceInvite.usedAt), gt(spaceInvite.expiresAt, timestamp)));
}

export function createInviteRoutes(
  getDb: DbProvider,
  options: InviteRouteOptions = {}
) {
  const invite = new Hono();

  invite.get("/:token", async (c) => {
    const db = await getDb(c);
    const token = c.req.param("token");
    const userCount = await countUsers(db);
    if (userCount >= MAX_SPACE_USERS) {
      return c.json({ valid: false, reason: "full" }, 410);
    }

    const row = await db
      .select()
      .from(spaceInvite)
      .where(eq(spaceInvite.token, token))
      .get();

    if (!row || row.usedAt) {
      return c.json({ valid: false, reason: "used" }, 404);
    }
    if (row.expiresAt <= now()) {
      return c.json({ valid: false, reason: "expired" }, 410);
    }

    const inviter = await getSpaceAuthors(db).then((authors) =>
      authors.find((a) => a.id === row.createdBy)
    );

    return c.json({
      valid: true,
      inviterName: inviter?.name ?? "对方",
      expiresAt: row.expiresAt,
    });
  });

  invite.post("/:token/accept", async (c) => {
    const db = await getDb(c);
    const token = c.req.param("token");
    const userCount = await countUsers(db);
    if (userCount >= MAX_SPACE_USERS) {
      return c.json({ error: "空间已满员" }, 403);
    }

    const row = await db
      .select()
      .from(spaceInvite)
      .where(eq(spaceInvite.token, token))
      .get();

    if (!row || row.usedAt) {
      return c.json({ error: "邀请无效或已使用" }, 404);
    }
    if (row.expiresAt <= now()) {
      return c.json({ error: "邀请已过期" }, 410);
    }

    let body: { email?: string; password?: string; displayName?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    try {
      const created = await createSpaceUser(db, {
        email: body.email ?? "",
        password: body.password ?? "",
        displayName: body.displayName ?? "",
      });
      const timestamp = now();
      await db
        .update(spaceInvite)
        .set({ usedAt: timestamp, updatedAt: timestamp })
        .where(eq(spaceInvite.id, row.id));

      await recordAudit(db, {
        userId: created.userId,
        author: created.name,
        action: "invite.accept",
        resourceType: "space",
        resourceId: row.id,
        metadata: { email: created.email },
        requestId: getRequestId(c),
      });

      return c.json({ ok: true });
    } catch (err) {
      const message = err instanceof Error ? err.message : "注册失败";
      if (message === "SPACE_FULL") {
        return c.json({ error: "空间已满员" }, 403);
      }
      return c.json({ error: message }, 400);
    }
  });

  invite.post("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const userCount = await countUsers(db);
    if (userCount !== 1) {
      return c.json({ error: "当前无法生成邀请" }, 400);
    }

    const timestamp = now();
    await invalidateActiveInvites(db, timestamp);

    const token = generateToken();
    const id = generateId("inv");
    const expiresAt = timestamp + INVITE_TTL_SECONDS;
    await db.insert(spaceInvite).values({
      id,
      token,
      createdBy: session.userId,
      expiresAt,
      usedAt: null,
      createdAt: timestamp,
      updatedAt: timestamp,
    });

    const baseUrl = (options.getBaseUrl?.(c) ?? "").replace(/\/$/, "");
    const url = `${baseUrl}/join?token=${encodeURIComponent(token)}`;

    await recordAudit(db, {
      userId: session.userId,
      author: session.author,
      action: "invite.create",
      resourceType: "space",
      resourceId: id,
      metadata: { expiresAt },
      requestId: getRequestId(c),
    });

    return c.json({ url, token, expiresAt });
  });

  invite.get("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const timestamp = now();
    const row = await db
      .select()
      .from(spaceInvite)
      .where(
        and(isNull(spaceInvite.usedAt), gt(spaceInvite.expiresAt, timestamp))
      )
      .orderBy(desc(spaceInvite.createdAt))
      .get();

    if (!row) return c.json({ active: false });

    const baseUrl = (options.getBaseUrl?.(c) ?? "").replace(/\/$/, "");
    return c.json({
      active: true,
      url: `${baseUrl}/join?token=${encodeURIComponent(row.token)}`,
      expiresAt: row.expiresAt,
    });
  });

  return invite;
}

export async function buildSpaceStatus(db: any) {
  const userCount = await countUsers(db);
  const authors = await getSpaceAuthors(db);
  return {
    userCount,
    signupOpen: userCount === 0,
    authors,
  };
}
