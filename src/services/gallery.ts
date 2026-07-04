import { eq, isNull } from "drizzle-orm";
import { asset, entry, memo } from "../db/schema.js";
import {
  extractStorageKeysFromBody,
  isImageStorageKey,
  mimeTypeFromKey,
  normalizeStorageKey,
} from "../lib/gallery-keys.js";

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

interface SourceBucket {
  sources: GallerySource[];
  maxEntryDate: number | null;
}

function sourceKey(source: GallerySource): string {
  return `${source.type}:${source.id}`;
}

function addSource(bucket: SourceBucket, source: GallerySource) {
  const key = sourceKey(source);
  if (bucket.sources.some((s) => sourceKey(s) === key)) return;
  bucket.sources.push(source);
  if (source.entryDate != null) {
    bucket.maxEntryDate =
      bucket.maxEntryDate == null
        ? source.entryDate
        : Math.max(bucket.maxEntryDate, source.entryDate);
  }
}

function buildReferenceIndex(
  entries: Array<{
    id: string;
    type: string;
    title: string | null;
    entryDate: number | null;
    body: string | null;
    deletedAt: number | null;
  }>,
  memos: Array<{
    id: string;
    title: string;
    body: string | null;
    deletedAt: number | null;
  }>,
  assets: Array<{
    entryId: string | null;
    storageKey: string;
    createdAt: number;
  }>,
  entryById: Map<string, (typeof entries)[number]>
): Map<string, SourceBucket> {
  const index = new Map<string, SourceBucket>();

  const ensure = (storageKey: string): SourceBucket => {
    const normalized = normalizeStorageKey(storageKey);
    let bucket = index.get(normalized);
    if (!bucket) {
      bucket = { sources: [], maxEntryDate: null };
      index.set(normalized, bucket);
    }
    return bucket;
  };

  for (const row of entries) {
    const source: GallerySource = {
      type: row.type,
      id: row.id,
      title: row.title,
      entryDate: row.entryDate,
      deleted: row.deletedAt != null,
    };
    for (const key of extractStorageKeysFromBody(row.body)) {
      addSource(ensure(key), source);
    }
  }

  for (const row of memos) {
    const source: GallerySource = {
      type: "memo",
      id: row.id,
      title: row.title,
      entryDate: null,
      deleted: row.deletedAt != null,
    };
    for (const key of extractStorageKeysFromBody(row.body)) {
      addSource(ensure(key), source);
    }
  }

  for (const row of assets) {
    if (!row.entryId) continue;
    const linkedEntry = entryById.get(row.entryId);
    if (!linkedEntry) continue;
    addSource(ensure(row.storageKey), {
      type: linkedEntry.type,
      id: linkedEntry.id,
      title: linkedEntry.title,
      entryDate: linkedEntry.entryDate,
      deleted: linkedEntry.deletedAt != null,
    });
  }

  return index;
}

type AssetRow = {
  id: string;
  entryId: string | null;
  storageKey: string;
  mimeType: string;
  size: number | null;
  createdAt: number;
};

type EntryRow = {
  id: string;
  type: string;
  title: string | null;
  entryDate: number | null;
  body: string | null;
  deletedAt: number | null;
};

type MemoRow = {
  id: string;
  title: string;
  body: string | null;
  deletedAt: number | null;
};

async function loadGalleryContext(db: any) {
  const entries: EntryRow[] = await db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      entryDate: entry.entryDate,
      body: entry.body,
      deletedAt: entry.deletedAt,
    })
    .from(entry);

  const memos: MemoRow[] = await db
    .select({
      id: memo.id,
      title: memo.title,
      body: memo.body,
      deletedAt: memo.deletedAt,
    })
    .from(memo);

  const assets: AssetRow[] = await db
    .select({
      id: asset.id,
      entryId: asset.entryId,
      storageKey: asset.storageKey,
      mimeType: asset.mimeType,
      size: asset.size,
      createdAt: asset.createdAt,
    })
    .from(asset)
    .where(isNull(asset.deletedAt));

  const entryById = new Map(entries.map((row) => [row.id, row]));
  const assetByKey = new Map(assets.map((row) => [normalizeStorageKey(row.storageKey), row]));
  const referenceIndex = buildReferenceIndex(entries, memos, assets, entryById);

  return { assetByKey, referenceIndex };
}

function objectToGalleryItem(
  obj: GalleryObjectMeta,
  assetByKey: Map<string, AssetRow>,
  referenceIndex: Map<string, SourceBucket>
): GalleryItem {
  const storageKey = normalizeStorageKey(obj.key);
  const bucket = referenceIndex.get(storageKey);
  const sources = bucket?.sources ?? [];
  const assetRow = assetByKey.get(storageKey);
  const sortAt = bucket?.maxEntryDate ?? assetRow?.createdAt ?? obj.uploadedAt;

  return {
    storageKey,
    url: `/assets/${storageKey}`,
    mimeType: assetRow?.mimeType ?? mimeTypeFromKey(storageKey),
    size: assetRow?.size ?? obj.size,
    uploadedAt: obj.uploadedAt,
    sortAt,
    linked: sources.length > 0,
    sources,
  };
}

export async function getGalleryItem(
  db: any,
  objects: GalleryObjectMeta[],
  storageKey: string
): Promise<GalleryItem | null> {
  const normalized = normalizeStorageKey(storageKey);
  const obj = objects.find((row) => normalizeStorageKey(row.key) === normalized);
  if (!obj) return null;
  const { assetByKey, referenceIndex } = await loadGalleryContext(db);
  return objectToGalleryItem(obj, assetByKey, referenceIndex);
}

export async function listGalleryItems(
  db: any,
  objects: GalleryObjectMeta[],
  options: { filter?: GalleryFilter; limit?: number; offset?: number } = {}
): Promise<{ items: GalleryItem[]; total: number }> {
  const filter = options.filter ?? "all";
  const limit = Math.min(Math.max(options.limit ?? 48, 1), 100);
  const offset = Math.max(options.offset ?? 0, 0);

  const { assetByKey, referenceIndex } = await loadGalleryContext(db);

  const items: GalleryItem[] = objects
    .filter((obj) => isImageStorageKey(obj.key))
    .map((obj) => objectToGalleryItem(obj, assetByKey, referenceIndex))
    .filter((item) => {
      if (filter === "linked") return item.linked;
      if (filter === "orphan") return !item.linked;
      return true;
    })
    .sort((a, b) => b.sortAt - a.sortAt);

  const total = items.length;
  const page = items.slice(offset, offset + limit);
  return { items: page, total };
}

export async function deleteGalleryObject(
  db: any,
  objects: GalleryObjectMeta[],
  storageKey: string
): Promise<{ ok: true } | { error: string; sources: GallerySource[] }> {
  const normalized = normalizeStorageKey(storageKey);
  const exists = objects.some((obj) => normalizeStorageKey(obj.key) === normalized);
  if (!exists) {
    return { error: "图片不存在", sources: [] };
  }

  const item = await getGalleryItem(db, objects, normalized);
  if (item?.linked && item.sources.length > 0) {
    return {
      error: `该图片仍被 ${item.sources.length} 处内容引用，无法删除`,
      sources: item.sources,
    };
  }

  return { ok: true };
}

export async function markAssetDeleted(db: any, storageKey: string): Promise<void> {
  const now = Math.floor(Date.now() / 1000);
  await db
    .update(asset)
    .set({ deletedAt: now })
    .where(eq(asset.storageKey, storageKey));
}

export async function listAllR2Objects(bucket: R2Bucket): Promise<GalleryObjectMeta[]> {
  const objects: GalleryObjectMeta[] = [];
  let cursor: string | undefined;

  do {
    const listed = await bucket.list({ limit: 1000, cursor });
    for (const obj of listed.objects) {
      objects.push({
        key: obj.key,
        size: obj.size,
        uploadedAt: Math.floor(obj.uploaded.getTime() / 1000),
      });
    }
    cursor = listed.truncated ? listed.cursor : undefined;
  } while (cursor);

  return objects;
}
