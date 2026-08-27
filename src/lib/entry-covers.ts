import { and, asc, inArray, isNotNull, isNull } from "drizzle-orm";
import { asset } from "../db/schema.js";
import { listImageUrl } from "./gallery-keys.js";

/** D1 max bound parameters per query is 100; leave headroom for other predicates. */
const D1_IN_CHUNK = 90;

export interface EntryCover {
  url: string;
  blurhash: string | null;
  width: number | null;
  height: number | null;
}

/** First image per entry for list covers. */
export async function loadCoversForEntries(
  db: any,
  entryIds: string[]
): Promise<Map<string, EntryCover>> {
  const map = new Map<string, EntryCover>();
  if (entryIds.length === 0) return map;

  for (let i = 0; i < entryIds.length; i += D1_IN_CHUNK) {
    const chunk = entryIds.slice(i, i + D1_IN_CHUNK);
    const rows = await db
      .select({
        entryId: asset.entryId,
        storageKey: asset.storageKey,
        blurhash: asset.blurhash,
        width: asset.width,
        height: asset.height,
        hasThumb: asset.hasThumb,
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
      map.set(row.entryId, {
        url: listImageUrl(row.storageKey, row.hasThumb),
        blurhash: row.blurhash ?? null,
        width: row.width ?? null,
        height: row.height ?? null,
      });
    }
  }
  return map;
}
