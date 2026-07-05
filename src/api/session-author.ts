import type { Context } from "hono";
import type { Auth } from "../auth.js";
import { resolveSessionAuthor } from "../lib/request-auth.js";
import { INVALID_SESSION_ERROR } from "../services/space-authors.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface SessionAuthor {
  userId: string;
  /** 当前爱称（user.name） */
  author: string;
}

export async function getSessionAuthor(
  c: Context,
  auth: Auth,
  getDb: DbProvider
): Promise<SessionAuthor | null> {
  return resolveSessionAuthor(c, auth, getDb);
}

export { INVALID_SESSION_ERROR };
