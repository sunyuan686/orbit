import { and, asc, count, desc, eq, inArray, isNull, or, sql } from "drizzle-orm";
import { album, albumAsset, asset, user } from "../../db/schema.js";
import { generateId } from "../../lib/id.js";
import { listImageUrl, normalizeStorageKey, publicAssetUrl } from "../../lib/gallery-keys.js";
import { loadUserNameMap, resolveUserName } from "../../lib/author-present.js";
import { loadSourcesForKeys, type GallerySource } from "./gallery.js";

export const SYSTEM_ALL_ALBUM_ID = "all";

export const imageAssetCondition = and(
  isNull(asset.deletedAt),
  sql`(${asset.mimeType} LIKE 'image/%' OR lower(${asset.storageKey}) LIKE '%.jpg' OR lower(${asset.storageKey}) LIKE '%.jpeg' OR lower(${asset.storageKey}) LIKE '%.png' OR lower(${asset.storageKey}) LIKE '%.webp' OR lower(${asset.storageKey}) LIKE '%.gif')`
);

export interface AlbumSummary {
  id: string;
  title: string;
  description: string | null;
  coverUrl: string | null;
  coverStorageKey: string | null;
  photoCount: number;
  author: string;
  authorName: string;
  createdByUserId: string | null;
  isDefault: boolean;
  sortOrder: number;
  createdAt: number;
  updatedAt: number;
}

export interface AlbumPhotoItem {
  id: string;
  assetId: string;
  storageKey: string;
  url: string;
  thumbUrl: string;
  width: number | null;
  height: number | null;
  blurhash: string | null;
  caption: string | null;
  createdAt: number;
  sources?: GallerySource[];
}

export interface AlbumDetail extends AlbumSummary {
  photos: AlbumPhotoItem[];
}

export async function listAlbums(db: any): Promise<AlbumSummary[]> {
  // 1. 统计全量图片类 asset，构造置顶的系统默认相册《全部照片》
  const totalRes = await db
    .select({ total: count(asset.id) })
    .from(asset)
    .where(imageAssetCondition);
  const totalImageCount = Number(totalRes[0]?.total ?? 0);

  const latestAsset = await db
    .select({
      storageKey: asset.storageKey,
      hasThumb: asset.hasThumb,
      createdAt: asset.createdAt,
    })
    .from(asset)
    .where(imageAssetCondition)
    .orderBy(desc(asset.createdAt))
    .limit(1);

  const firstLatest = latestAsset[0];
  const systemAlbum: AlbumSummary = {
    id: SYSTEM_ALL_ALBUM_ID,
    title: "全部照片",
    description: null,
    coverUrl: firstLatest ? listImageUrl(firstLatest.storageKey, firstLatest.hasThumb) : null,
    coverStorageKey: firstLatest?.storageKey ?? null,
    photoCount: totalImageCount,
    author: "系统",
    authorName: "空间记忆",
    createdByUserId: null,
    isDefault: true,
    sortOrder: -9999,
    createdAt: 0,
    updatedAt: firstLatest ? Number(firstLatest.createdAt) : Math.floor(Date.now() / 1000),
  };

  const albums = await db
    .select({
      id: album.id,
      title: album.title,
      description: album.description,
      coverStorageKey: album.coverStorageKey,
      author: album.author,
      createdByUserId: album.createdByUserId,
      isDefault: album.isDefault,
      sortOrder: album.sortOrder,
      createdAt: album.createdAt,
      updatedAt: album.updatedAt,
    })
    .from(album)
    .where(isNull(album.deletedAt))
    .orderBy(asc(album.sortOrder), desc(album.createdAt));

  if (albums.length === 0) return [systemAlbum];

  // 获取各相册照片数与首张照片（用作缺省封面）
  const stats = await db
    .select({
      albumId: albumAsset.albumId,
      photoCount: count(albumAsset.id),
    })
    .from(albumAsset)
    .groupBy(albumAsset.albumId);

  const statsMap = new Map<string, number>();
  for (const s of stats) {
    statsMap.set(s.albumId, Number(s.photoCount));
  }

  // 查出所有需要封面图的 storageKey
  const firstAssets = await db
    .select({
      albumId: albumAsset.albumId,
      storageKey: asset.storageKey,
      hasThumb: asset.hasThumb,
    })
    .from(albumAsset)
    .innerJoin(asset, eq(albumAsset.assetId, asset.id))
    .where(isNull(asset.deletedAt))
    .orderBy(asc(albumAsset.sortOrder), asc(albumAsset.createdAt));

  const firstAssetMap = new Map<string, { storageKey: string; hasThumb: number }>();
  for (const fa of firstAssets) {
    if (!firstAssetMap.has(fa.albumId)) {
      firstAssetMap.set(fa.albumId, {
        storageKey: fa.storageKey,
        hasThumb: Number(fa.hasThumb),
      });
    }
  }

  const userIds = albums.map((a: { createdByUserId: string | null }) => a.createdByUserId);
  const nameMap = await loadUserNameMap(db, userIds);

  const userAlbums = albums.map((a: any) => {
    const authorName = resolveUserName(nameMap, a.createdByUserId, a.author) || a.author || "";
    const photoCount = statsMap.get(a.id) ?? 0;
    let coverUrl: string | null = null;

    if (a.coverStorageKey) {
      coverUrl = listImageUrl(a.coverStorageKey, 1);
    } else {
      const fallback = firstAssetMap.get(a.id);
      if (fallback) {
        coverUrl = listImageUrl(fallback.storageKey, fallback.hasThumb);
      }
    }

    return {
      id: a.id,
      title: a.title,
      description: a.description,
      coverUrl,
      coverStorageKey: a.coverStorageKey,
      photoCount,
      author: a.author,
      authorName,
      createdByUserId: a.createdByUserId,
      isDefault: Boolean(a.isDefault),
      sortOrder: a.sortOrder,
      createdAt: a.createdAt,
      updatedAt: a.updatedAt,
    };
  });

  return [systemAlbum, ...userAlbums];
}

export async function getAlbum(db: any, albumId: string): Promise<AlbumDetail | null> {
  if (albumId === SYSTEM_ALL_ALBUM_ID) {
    const photoRows = await db
      .select({
        assetId: asset.id,
        storageKey: asset.storageKey,
        hasThumb: asset.hasThumb,
        width: asset.width,
        height: asset.height,
        blurhash: asset.blurhash,
        createdAt: asset.createdAt,
      })
      .from(asset)
      .where(imageAssetCondition)
      .orderBy(desc(asset.createdAt));

    const keys = photoRows.map((p: any) => p.storageKey);
    const sourcesByKey = await loadSourcesForKeys(db, keys);

    const photos: AlbumPhotoItem[] = photoRows.map((p: any) => ({
      id: p.assetId,
      assetId: p.assetId,
      storageKey: p.storageKey,
      url: publicAssetUrl(p.storageKey),
      thumbUrl: listImageUrl(p.storageKey, p.hasThumb),
      width: p.width,
      height: p.height,
      blurhash: p.blurhash,
      caption: null,
      createdAt: p.createdAt,
      sources: sourcesByKey.get(normalizeStorageKey(p.storageKey)) ?? [],
    }));

    const coverUrl = photos.length > 0 ? photos[0].thumbUrl : null;
    const coverStorageKey = photos.length > 0 ? photos[0].storageKey : null;

    return {
      id: SYSTEM_ALL_ALBUM_ID,
      title: "全部照片",
      description: null,
      coverUrl,
      coverStorageKey,
      photoCount: photos.length,
      author: "系统",
      authorName: "空间记忆",
      createdByUserId: null,
      isDefault: true,
      sortOrder: -9999,
      createdAt: 0,
      updatedAt: photos.length > 0 ? photos[0].createdAt : Math.floor(Date.now() / 1000),
      photos,
    };
  }

  const row = await db
    .select()
    .from(album)
    .where(and(eq(album.id, albumId), isNull(album.deletedAt)))
    .get();

  if (!row) return null;

  const photoRows = await db
    .select({
      linkId: albumAsset.id,
      assetId: asset.id,
      storageKey: asset.storageKey,
      hasThumb: asset.hasThumb,
      width: asset.width,
      height: asset.height,
      blurhash: asset.blurhash,
      caption: albumAsset.caption,
      createdAt: albumAsset.createdAt,
    })
    .from(albumAsset)
    .innerJoin(asset, eq(albumAsset.assetId, asset.id))
    .where(and(eq(albumAsset.albumId, albumId), isNull(asset.deletedAt)))
    .orderBy(asc(albumAsset.sortOrder), desc(albumAsset.createdAt));

  const nameMap = await loadUserNameMap(db, [row.createdByUserId]);
  const authorName = resolveUserName(nameMap, row.createdByUserId, row.author) || row.author || "";

  const customKeys = photoRows.map((p: any) => p.storageKey);
  const customSourcesByKey = await loadSourcesForKeys(db, customKeys);

  const photos: AlbumPhotoItem[] = photoRows.map((p: any) => ({
    id: p.linkId,
    assetId: p.assetId,
    storageKey: p.storageKey,
    url: publicAssetUrl(p.storageKey),
    thumbUrl: listImageUrl(p.storageKey, p.hasThumb),
    width: p.width,
    height: p.height,
    blurhash: p.blurhash,
    caption: p.caption,
    createdAt: p.createdAt,
    sources: customSourcesByKey.get(normalizeStorageKey(p.storageKey)) ?? [],
  }));

  let coverUrl: string | null = null;
  if (row.coverStorageKey) {
    coverUrl = listImageUrl(row.coverStorageKey, 1);
  } else if (photos.length > 0) {
    coverUrl = photos[0].thumbUrl;
  }

  return {
    id: row.id,
    title: row.title,
    description: row.description,
    coverUrl,
    coverStorageKey: row.coverStorageKey,
    photoCount: photos.length,
    author: row.author,
    authorName,
    createdByUserId: row.createdByUserId,
    isDefault: Boolean(row.isDefault),
    sortOrder: row.sortOrder,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    photos,
  };
}

export async function createAlbum(
  db: any,
  input: {
    title: string;
    description?: string | null;
    coverStorageKey?: string | null;
    userId: string;
    author: string;
  }
): Promise<string> {
  const id = generateId("alb");
  const nowTs = Math.floor(Date.now() / 1000);
  await db.insert(album).values({
    id,
    title: input.title.trim(),
    description: input.description?.trim() || null,
    coverStorageKey: input.coverStorageKey || null,
    createdByUserId: input.userId,
    author: input.author,
    createdAt: nowTs,
    updatedAt: nowTs,
  });
  return id;
}

export async function updateAlbum(
  db: any,
  albumId: string,
  input: {
    title?: string;
    description?: string | null;
    coverStorageKey?: string | null;
    sortOrder?: number;
  }
): Promise<boolean> {
  if (albumId === SYSTEM_ALL_ALBUM_ID) return false;

  const updates: Record<string, unknown> = {
    updatedAt: Math.floor(Date.now() / 1000),
  };
  if (input.title !== undefined) updates.title = input.title.trim();
  if (input.description !== undefined) updates.description = input.description?.trim() || null;
  if (input.coverStorageKey !== undefined) updates.coverStorageKey = input.coverStorageKey || null;
  if (input.sortOrder !== undefined) updates.sortOrder = input.sortOrder;

  const result = await db.update(album).set(updates).where(eq(album.id, albumId));
  return Boolean(result);
}

export async function deleteAlbum(db: any, albumId: string): Promise<boolean> {
  if (albumId === SYSTEM_ALL_ALBUM_ID) return false;

  await db
    .update(album)
    .set({ deletedAt: Math.floor(Date.now() / 1000) })
    .where(eq(album.id, albumId));
  return true;
}

export async function addAssetsToAlbum(
  db: any,
  albumId: string,
  assetIds: string[]
): Promise<number> {
  if (albumId === SYSTEM_ALL_ALBUM_ID || assetIds.length === 0) return 0;
  const nowTs = Math.floor(Date.now() / 1000);

  // 解析真实的 asset.id（兼容传入 asset.id 或 storageKey）
  const matched = await db
    .select({ id: asset.id })
    .from(asset)
    .where(
      and(
        isNull(asset.deletedAt),
        or(inArray(asset.id, assetIds), inArray(asset.storageKey, assetIds))
      )
    );

  const realAssetIds = matched.length > 0
    ? matched.map((a: { id: string }) => a.id)
    : assetIds;

  let insertedCount = 0;
  for (const assetId of realAssetIds) {
    const id = generateId("ala");
    try {
      await db.insert(albumAsset).values({
        id,
        albumId,
        assetId,
        createdAt: nowTs,
      });
      insertedCount++;
    } catch {
      // 忽略已存在的重复关联 (uniq_album_asset)
    }
  }

  if (insertedCount > 0) {
    await db
      .update(album)
      .set({ updatedAt: nowTs })
      .where(eq(album.id, albumId));
  }

  return insertedCount;
}

export async function removeAssetFromAlbum(
  db: any,
  albumId: string,
  assetId: string
): Promise<boolean> {
  if (albumId === SYSTEM_ALL_ALBUM_ID) return false;

  await db
    .delete(albumAsset)
    .where(and(eq(albumAsset.albumId, albumId), eq(albumAsset.assetId, assetId)));
  await db
    .update(album)
    .set({ updatedAt: Math.floor(Date.now() / 1000) })
    .where(eq(album.id, albumId));
  return true;
}
