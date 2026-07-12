import type { Context, Next } from "hono";
import type { Auth } from "../auth.js";
import type { SessionAuthor } from "../api/session-author.js";
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

  // 信任 better-auth session（含 cookieCache）；不再重复查 user / isSpaceUserId
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  const sessionName =
    typeof session?.user?.name === "string" ? session.user.name.trim() : "";
  if (session?.user?.id && sessionName) {
    const author: SessionAuthor = {
      userId: session.user.id,
      author: sessionName,
    };
    c.set("sessionAuthor", author);
    c.set("authMethod", "session");
    return author;
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
