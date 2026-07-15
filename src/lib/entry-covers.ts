import { and, asc, inArray, isNotNull, isNull } from "drizzle-orm";
import { asset } from "../db/schema.js";

/** D1 max bound parameters per query is 100; leave headroom for other predicates. */
const D1_IN_CHUNK = 90;

/** 批量取每条 entry 的首图 URL（`/assets/{storageKey}`）；无图不入 map。 */
export async function loadCoversForEntries(
  db: any,
  entryIds: string[]
): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  if (entryIds.length === 0) return map;

  for (let i = 0; i < entryIds.length; i += D1_IN_CHUNK) {
    const chunk = entryIds.slice(i, i + D1_IN_CHUNK);
    const rows = await db
      .select({
        entryId: asset.entryId,
        storageKey: asset.storageKey,
      })
      .from(asset)
      .where(
        and(
          inArray(asset.entryId, chunk),
          isNull(asset.deletedAt),
          isNotNull(asset.entryId)
        )
      )
      .orderBy(asc(asset.position), asc(asset.createdAt));

    for (const row of rows) {
      if (!row.entryId || map.has(row.entryId)) continue;
      map.set(row.entryId, `/assets/${row.storageKey}`);
    }
  }
  return map;
}
