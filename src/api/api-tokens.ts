import { Hono } from "hono";
import type { Context } from "hono";
import { getRequestId } from "../lib/request-context.js";
import { recordAudit } from "../services/audit.js";
import {
  createApiToken,
  getApiTokenForRevoke,
  listApiTokens,
  MAX_API_TOKENS,
  revokeApiToken,
} from "../services/api-token.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface ApiTokenRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: ApiTokenRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return c.json({ error: INVALID_SESSION_ERROR }, 400);
  return sessionAuthor;
}

const TOKEN_ERROR_MESSAGES: Record<string, string> = {
  TOKEN_NAME_REQUIRED: "请填写 Token 名称",
  TOKEN_NAME_TOO_LONG: "名称最多 64 个字符",
  TOKEN_LIMIT_REACHED: `最多保留 ${MAX_API_TOKENS} 个有效 Token，请先撤销旧 Token`,
};

export function createApiTokenRoutes(
  getDb: DbProvider,
  options: ApiTokenRouteOptions = {}
) {
  const routes = new Hono();

  routes.get("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const items = await listApiTokens(db);
    return c.json({ items });
  });

  routes.post("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { name?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求体格式无效" }, 400);
    }

    const db = await getDb(c);
    try {
      const created = await createApiToken(db, {
        name: body.name ?? "",
        sessionAuthor: session,
      });

      await recordAudit(db, {
        userId: session.userId,
        author: session.author,
        action: "api_token.create",
        resourceType: "settings",
        resourceId: created.id,
        metadata: { name: created.name, tokenPrefix: created.tokenPrefix },
        requestId: getRequestId(c),
      });

      return c.json(created, 201);
    } catch (err) {
      const code = err instanceof Error ? err.message : "";
      const message = TOKEN_ERROR_MESSAGES[code] ?? "创建失败";
      const status = code === "TOKEN_LIMIT_REACHED" ? 409 : 400;
      return c.json({ error: message }, status);
    }
  });

  routes.delete("/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const db = await getDb(c);
    const tokenId = c.req.param("id");
    const target = await getApiTokenForRevoke(db, tokenId);
    if (!target) return c.json({ error: "Token 不存在或已撤销" }, 404);

    const ok = await revokeApiToken(db, tokenId);
    if (!ok) return c.json({ error: "Token 不存在或已撤销" }, 404);

    await recordAudit(db, {
      userId: session.userId,
      author: session.author,
      action: "api_token.revoke",
      resourceType: "settings",
      resourceId: tokenId,
      metadata: { name: target.name },
      requestId: getRequestId(c),
    });

    return c.json({ ok: true });
  });

  return routes;
}
