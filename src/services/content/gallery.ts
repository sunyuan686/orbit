import { and, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { asset, assetReference, entry } from "../../db/schema.js";
import {
  isImageStorageKey,
  mimeTypeFromKey,
  normalizeStorageKey,
} from "../../lib/gallery-keys.js";
import {
  clearAssetReferencesForKey,
  ensureAssetReferencesBackfilled,
} from "./asset-references.js";

export type GalleryFilter = "all" | "linked" | "orphan";

export interface GallerySource {
  type: string;
  id: string;
  title: string | null;
  entryDate: number | null;
  deleted: boolean;
}

export interface GalleryItem {
  storageKey: string;
  url: string;
  mimeType: string;
  size: number;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  uploadedAt: number;
  sortAt: number;
  linked: boolean;
  sources: GallerySource[];
}

export interface GalleryObjectMeta {
  key: string;
  size: number;
  uploadedAt: number;
}

const imageKeyCondition = sql`(
  lower(asset.storage_key) like '%.jpg'
  or lower(asset.storage_key) like '%.jpeg'
  or lower(asset.storage_key) like '%.png'
  or lower(asset.storage_key) like '%.gif'
  or lower(asset.storage_key) like '%.webp'
  or lower(asset.storage_key) like '%.heic'
)`;

const linkedExists = sql`exists (
  select 1 from asset_reference
  where asset_reference.storage_key = asset.storage_key
)`;

function filterCondition(filter: GalleryFilter) {
  if (filter === "linked") return sql`${linkedExists}`;
  if (filter === "orphan") return sql`not ${linkedExists}`;
  return null;
}

/** D1 单语句绑定参数上限 100，IN 列表分块查询 */
const IN_CHUNK = 80;

async function selectInChunks<T>(
  ids: string[],
  run: (chunk: string[]) => Promise<T[]>
): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += IN_CHUNK) {
    out.push(...(await run(ids.slice(i, i + IN_CHUNK))));
  }
  return out;
}

async function loadSourcesForKeys(
  db: any,
  storageKeys: string[]
): Promise<Map<string, GallerySource[]>> {
  const result = new Map<string, GallerySource[]>();
  if (storageKeys.length === 0) return result;

  const refs = await selectInChunks(storageKeys, (chunk) =>
    db
      .select({
        storageKey: assetReference.storageKey,
        sourceType: assetReference.sourceType,
        sourceId: assetReference.sourceId,
      })
      .from(assetReference)
      .where(inArray(assetReference.storageKey, chunk))
  ) as Array<{
    storageKey: string;
    sourceType: string;
    sourceId: string;
  }>;

  if (refs.length === 0) return result;

  const entryIds = [...new Set(refs.map((r) => r.sourceId))];

  const entryRows = (await selectInChunks(entryIds, (chunk) =>
    db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        entryDate: entry.entryDate,
        deletedAt: entry.deletedAt,
      })
      .from(entry)
      .where(inArray(entry.id, chunk))
  )) as Array<{
    id: string;
    type: string;
    title: string | null;
    entryDate: number | null;
    deletedAt: number | null;
  }>;

  const entryById = new Map(entryRows.map((row) => [row.id, row]));

  for (const ref of refs) {
    const key = normalizeStorageKey(ref.storageKey);
    let sources = result.get(key);
    if (!sources) {
      sources = [];
      result.set(key, sources);
    }

    const row = entryById.get(ref.sourceId);
    if (!row) continue;
    sources.push({
      type: row.type,
      id: row.id,
      title: row.title,
      entryDate: row.entryDate,
      deleted: row.deletedAt != null,
    });
  }

  return result;
}

export async function getGalleryItem(
  db: any,
  storageKey: string
): Promise<GalleryItem | null> {
  await ensureAssetReferencesBackfilled(db);
  const normalized = normalizeStorageKey(storageKey);
  if (!isImageStorageKey(normalized)) return null;

  const row = (await db
    .select({
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      blurhash: asset.blurhash,
      createdAt: asset.createdAt,
    })
    .from(asset)
    .where(and(eq(asset.storageKey, normalized), isNull(asset.deletedAt)))
    .get()) as
    | {
        storageKey: string;
        mimeType: string;
        size: number | null;
        width: number | null;
        height: number | null;
        blurhash: string | null;
        createdAt: number;
      }
    | undefined;

  if (!row) return null;

  const sourcesByKey = await loadSourcesForKeys(db, [normalized]);
  const sources = sourcesByKey.get(normalized) ?? [];

  return {
    storageKey: normalized,
    url: `/assets/${normalized}`,
    mimeType: row.mimeType || mimeTypeFromKey(normalized),
    size: row.size ?? 0,
    width: row.width,
    height: row.height,
    blurhash: row.blurhash,
    uploadedAt: row.createdAt,
    sortAt: row.createdAt,
    linked: sources.length > 0,
    sources,
  };
}

export async function listGalleryItems(
  db: any,
  options: { filter?: GalleryFilter; limit?: number; offset?: number } = {}
): Promise<{ items: GalleryItem[]; total: number }> {
  await ensureAssetReferencesBackfilled(db);

  const filter = options.filter ?? "all";
  const limit = Math.min(Math.max(options.limit ?? 48, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const conditions = [isNull(asset.deletedAt), imageKeyCondition];
  const filterCond = filterCondition(filter);
  if (filterCond) conditions.push(filterCond);
  const where = and(...conditions);

  const countRow = (await db
    .select({ total: sql<number>`count(*)` })
    .from(asset)
    .where(where)
    .get()) as { total: number } | undefined;
  const total = Number(countRow?.total ?? 0);

  const rows = (await db
    .select({
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      size: asset.size,
      width: asset.width,
      height: asset.height,
      blurhash: asset.blurhash,
      createdAt: asset.createdAt,
      linked: sql<number>`case when ${linkedExists} then 1 else 0 end`,
    })
    .from(asset)
    .where(where)
    .orderBy(desc(asset.createdAt))
    .limit(limit)
    .offset(offset)) as Array<{
    storageKey: string;
    mimeType: string;
    size: number | null;
    width: number | null;
    height: number | null;
    blurhash: string | null;
    createdAt: number;
    linked: number;
  }>;

  const keys = rows.map((row) => normalizeStorageKey(row.storageKey));
  const sourcesByKey = await loadSourcesForKeys(db, keys);

  const items: GalleryItem[] = rows.map((row) => {
    const storageKey = normalizeStorageKey(row.storageKey);
    const sources = sourcesByKey.get(storageKey) ?? [];
    return {
      storageKey,
      url: `/assets/${storageKey}`,
      mimeType: row.mimeType || mimeTypeFromKey(storageKey),
      size: row.size ?? 0,
      width: row.width,
      height: row.height,
      blurhash: row.blurhash,
      uploadedAt: row.createdAt,
      sortAt: row.createdAt,
      linked: sources.length > 0 || row.linked === 1,
      sources,
    };
  });

  return { items, total };
}

export async function deleteGalleryObject(
  db: any,
  storageKey: string
): Promise<{ ok: true } | { error: string; sources: GallerySource[] }> {
  const item = await getGalleryItem(db, storageKey);
  if (!item) {
    return { error: "图片不存在", sources: [] };
  }
  if (item.linked && item.sources.length > 0) {
    return {
      error: `该图片仍被 ${item.sources.length} 处内容引用，无法删除`,
      sources: item.sources,
    };
  }
  return { ok: true };
}

export async function markAssetDeleted(db: any, storageKey: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  const normalized = normalizeStorageKey(storageKey);
  await db
    .update(asset)
    .set({ deletedAt: now })
    .where(eq(asset.storageKey, normalized));
  await clearAssetReferencesForKey(db, normalized);
}
