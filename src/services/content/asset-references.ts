import { and, eq } from "drizzle-orm";
import { assetReference, entry } from "../../db/schema.js";
import { extractStorageKeysFromBody } from "../../lib/gallery-keys.js";
import { readSettingsMap, upsertSetting } from "../../db/settings-store.js";

export const ASSET_REFERENCE_BACKFILL_KEY = "asset_reference_backfilled";

export type AssetReferenceSourceType = string;

/** D1 单语句绑定参数上限 100；每行 3 个参数，留余量按 30 行分块 */
const INSERT_CHUNK = 30;

function chunkRows<T>(rows: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < rows.length; i += size) {
    chunks.push(rows.slice(i, i + size));
  }
  return chunks;
}

/**
 * 按正文重写某一内容对图片的引用。软删内容时保留引用（恢复后仍一致）。
 */
export async function syncAssetReferences(
  db: any,
  sourceType: AssetReferenceSourceType,
  sourceId: string,
  body: string | null | undefined
): Promise<void> {
  const keys = [...new Set(extractStorageKeysFromBody(body))];

  const deleteStmt = db
    .delete(assetReference)
    .where(
      and(
        eq(assetReference.sourceType, sourceType),
        eq(assetReference.sourceId, sourceId)
      )
    );

  const insertStmts = chunkRows(keys, INSERT_CHUNK).map((chunk) =>
    db.insert(assetReference).values(
      chunk.map((storageKey) => ({ storageKey, sourceType, sourceId }))
    )
  );

  if (typeof db.batch === "function") {
    await db.batch([deleteStmt, ...insertStmts]);
  } else {
    await deleteStmt;
    for (const stmt of insertStmts) {
      await stmt;
    }
  }
}

export async function clearAssetReferencesForKey(
  db: any,
  storageKey: string
): Promise<void> {
  await db
    .delete(assetReference)
    .where(eq(assetReference.storageKey, storageKey));
}

async function backfillAssetReferences(db: any): Promise<void> {
  const entries = (await db
    .select({
      id: entry.id,
      type: entry.type,
      body: entry.body,
    })
    .from(entry)) as Array<{ id: string; type: string; body: string | null }>;

  await db.delete(assetReference);

  const rows: Array<{
    storageKey: string;
    sourceType: string;
    sourceId: string;
  }> = [];
  const seen = new Set<string>();

  for (const row of entries) {
    for (const storageKey of extractStorageKeysFromBody(row.body)) {
      const dedupe = `${storageKey}\0${row.type}\0${row.id}`;
      if (seen.has(dedupe)) continue;
      seen.add(dedupe);
      rows.push({
        storageKey,
        sourceType: row.type,
        sourceId: row.id,
      });
    }
  }

  for (const chunk of chunkRows(rows, INSERT_CHUNK)) {
    await db.insert(assetReference).values(chunk);
  }

  await upsertSetting(db, ASSET_REFERENCE_BACKFILL_KEY, "1");
}

/** 首次相册读取时一次性回填；之后写路径维护。 */
export async function ensureAssetReferencesBackfilled(db: any): Promise<void> {
  const map = await readSettingsMap(db);
  if (map[ASSET_REFERENCE_BACKFILL_KEY] === "1") return;
  await backfillAssetReferences(db);
}
