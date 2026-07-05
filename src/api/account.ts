import { Hono } from "hono";
import type { Context } from "hono";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/audit.js";
import { updateUserDisplayName } from "../services/user-signup.js";
import { getRequestId } from "../lib/request-context.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface AccountRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: AccountRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return c.json({ error: INVALID_SESSION_ERROR }, 400);
  return sessionAuthor;
}

export function createAccountRoutes(
  getDb: DbProvider,
  options: AccountRouteOptions = {}
) {
  const account = new Hono();

  account.put("/profile", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { name?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    if (typeof body.name !== "string") {
      return c.json({ error: "请提供爱称" }, 400);
    }

    const db = await getDb(c);
    try {
      const name = await updateUserDisplayName(db, session.userId, body.name);
      await recordAudit(db, {
        userId: session.userId,
        author: name,
        action: "account.profile.update",
        resourceType: AuditResourceType.SPACE,
        resourceId: session.userId,
        metadata: {},
        requestId: getRequestId(c),
      });
      return c.json({ name });
    } catch (err) {
      const message = err instanceof Error ? err.message : "更新失败";
      return c.json({ error: message }, 400);
    }
  });

  return account;
}
