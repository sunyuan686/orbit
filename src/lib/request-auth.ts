import type { Context, Next } from "hono";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth.js";
import { user } from "../db/schema.js";
import type { SessionAuthor } from "../api/session-author.js";
import { isSpaceUserId } from "../services/space-authors.js";
import { verifyApiToken } from "../services/api-token.js";

declare module "hono" {
  interface ContextVariableMap {
    requestId: string;
    sessionAuthor: SessionAuthor;
    authMethod: "session" | "api_token";
    apiTokenId: string;
  }
}

type DbProvider = (c: Context) => any | Promise<any>;

export function parseBearerToken(
  authorization: string | undefined
): string | null {
  if (!authorization?.startsWith("Bearer ")) return null;
  const token = authorization.slice("Bearer ".length).trim();
  return token || null;
}

export async function resolveSessionAuthor(
  c: Context,
  auth: Auth,
  getDb: DbProvider
): Promise<SessionAuthor | null> {
  try {
    const cached = c.get("sessionAuthor");
    if (cached) return cached;
  } catch {
    // not set yet
  }

  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (session?.user?.id) {
    const db = await getDb(c);
    const row = await db
      .select({ id: user.id, name: user.name })
      .from(user)
      .where(eq(user.id, session.user.id))
      .get();

    if (row?.name?.trim() && (await isSpaceUserId(db, row.id))) {
      const author: SessionAuthor = {
        userId: row.id,
        author: row.name.trim(),
      };
      c.set("sessionAuthor", author);
      c.set("authMethod", "session");
      return author;
    }
  }

  const bearer = parseBearerToken(c.req.header("Authorization"));
  if (bearer) {
    const db = await getDb(c);
    const verified = await verifyApiToken(db, bearer);
    if (verified) {
      c.set("sessionAuthor", verified.author);
      c.set("authMethod", "api_token");
      c.set("apiTokenId", verified.tokenId);
      return verified.author;
    }
  }

  return null;
}

export interface RequireAuthOptions {
  getAuth: (c: Context) => Auth;
  getDb: DbProvider;
  /** 默认 true；false 时仅允许 Cookie 会话 */
  allowApiToken?: boolean;
}

export function createRequireAuth(options: RequireAuthOptions) {
  const allowApiToken = options.allowApiToken ?? true;

  return async (c: Context, next: Next) => {
    const auth = options.getAuth(c);
    const author = await resolveSessionAuthor(c, auth, options.getDb);
    if (!author) return c.json({ error: "Unauthorized" }, 401);

    if (!allowApiToken) {
      try {
        if (c.get("authMethod") === "api_token") {
          return c.json({ error: "Session required" }, 403);
        }
      } catch {
        return c.json({ error: "Session required" }, 403);
      }
    }

    return next();
  };
}
