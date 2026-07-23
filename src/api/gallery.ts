import { Hono } from "hono";
import type { Context } from "hono";
import { createLogger } from "../lib/logger.js";
import {
  deleteGalleryObject,
  listGalleryItems,
  markAssetDeleted,
  type GalleryFilter,
} from "../services/gallery.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface GalleryStorageProvider {
  deleteObject(c: Context, storageKey: string): Promise<boolean>;
}

const log = createLogger("gallery");

function parseFilter(value: string | undefined): GalleryFilter {
  if (value === "linked" || value === "orphan") return value;
  return "all";
}

export function createGalleryRoutes(
  getDb: DbProvider,
  storage: GalleryStorageProvider
) {
  const gallery = new Hono();

  gallery.get("/", async (c) => {
    const db = await getDb(c);
    const filter = parseFilter(c.req.query("filter"));
    const limitParam = c.req.query("limit");
    const offsetParam = c.req.query("offset");
    const limit = limitParam ? parseInt(limitParam, 10) : 48;
    const offset = offsetParam ? parseInt(offsetParam, 10) : 0;

    try {
      const { items, total } = await listGalleryItems(db, {
        filter,
        limit,
        offset,
      });
      return c.json({ items, total, limit, offset, filter });
    } catch (err) {
      log.error("list failed", err);
      return c.json({ error: "相册加载失败" }, 500);
    }
  });

  gallery.delete("/:storageKey", async (c) => {
    const db = await getDb(c);
    const storageKey = decodeURIComponent(c.req.param("storageKey"));

    try {
      const check = await deleteGalleryObject(db, storageKey);
      if (!("ok" in check)) {
        return c.json({ error: check.error, sources: check.sources }, 400);
      }

      const deleted = await storage.deleteObject(c, storageKey);
      if (!deleted) {
        return c.json({ error: "图片不存在" }, 404);
      }

      await markAssetDeleted(db, storageKey);
      return c.json({ ok: true });
    } catch (err) {
      log.error("delete failed", err, { storageKey });
      return c.json({ error: "删除失败" }, 500);
    }
  });

  return gallery;
}
