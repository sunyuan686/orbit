import type { Context } from "hono";
import { eq } from "drizzle-orm";
import type { Auth } from "../auth.js";
import { isCanonicalAuthor, normalizeAuthor } from "../authors.js";
import { user } from "../db/schema.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface SessionAuthor {
  userId: string;
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

  if (!row) return null;

  const author = normalizeAuthor(row.name);
  if (!isCanonicalAuthor(author)) return null;

  return { userId: row.id, author };
}
