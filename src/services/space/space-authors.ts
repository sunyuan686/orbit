import { asc, eq } from "drizzle-orm";
import { user } from "../../db/schema.js";

export const MAX_SPACE_USERS = 2;
export const INVALID_SESSION_ERROR =
  "账号身份无效，请重新登录或联系空间管理员";

export interface SpaceAuthor {
  id: string;
  name: string;
}

export async function countUsers(db: any): Promise<number> {
  const rows = await db.select({ id: user.id }).from(user);
  return rows.length;
}

export async function getSpaceAuthors(db: any): Promise<SpaceAuthor[]> {
  const rows = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .orderBy(asc(user.createdAt))
    .limit(MAX_SPACE_USERS);
  return rows;
}

export async function getSpaceUserIds(db: any): Promise<string[]> {
  const authors = await getSpaceAuthors(db);
  return authors.map((row) => row.id);
}

export async function getOtherUserId(
  db: any,
  userId: string
): Promise<string | null> {
  const authors = await getSpaceAuthors(db);
  const other = authors.find((row) => row.id !== userId);
  return other?.id ?? null;
}

export async function getUserById(
  db: any,
  userId: string
): Promise<SpaceAuthor | null> {
  const row = await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  return row ?? null;
}

export async function isSpaceUserId(db: any, userId: string): Promise<boolean> {
  const row = await db
    .select({ id: user.id })
    .from(user)
    .where(eq(user.id, userId))
    .get();
  return Boolean(row);
}
