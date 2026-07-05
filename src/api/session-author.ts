import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth.js";
import { user } from "../db/schema.js";
import {
  INVALID_SESSION_ERROR,
  isSpaceUserId,
} from "../services/space-authors.js";

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
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session?.user?.id) return null;

  const db = await getDb(c);
  const row = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, session.user.id))
    .get();

  if (!row?.name?.trim()) return null;
  if (!(await isSpaceUserId(db, row.id))) return null;

  return { userId: row.id, author: row.name.trim() };
}

export { INVALID_SESSION_ERROR };
