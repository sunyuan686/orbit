import { asc, inArray } from "drizzle-orm";
import { user } from "../db/schema.js";

export interface UserNameRow {
  id: string;
  name: string;
}

export async function loadUserNameMap(
  db: any,
  userIds: Iterable<string | null | undefined>
): Promise<Map<string, string>> {
  const ids = [...new Set([...userIds].filter((id): id is string => Boolean(id)))];
  if (ids.length === 0) return new Map();

  const rows = (await db
    .select({ id: user.id, name: user.name })
    .from(user)
    .where(inArray(user.id, ids))) as UserNameRow[];

  return new Map(rows.map((row) => [row.id, row.name]));
}

export function resolveUserName(
  map: Map<string, string>,
  userId: string | null | undefined,
  fallback?: string | null
): string | null {
  if (userId && map.has(userId)) return map.get(userId)!;
  return fallback?.trim() || null;
}
