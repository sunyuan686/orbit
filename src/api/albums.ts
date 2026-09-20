import { Hono } from "hono";
import type { Context } from "hono";
import {
  listAlbums,
  getAlbum,
  createAlbum,
  updateAlbum,
  deleteAlbum,
  addAssetsToAlbum,
  removeAssetFromAlbum,
} from "../services/content/albums.js";
import { createLogger } from "../lib/logger.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("albums");

export interface AlbumsRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: AlbumsRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return c.json({ error: INVALID_SESSION_ERROR }, 400);
  return sessionAuthor;
}

export function createAlbumsRoutes(
  getDb: DbProvider,
  options: AlbumsRouteOptions = {}
) {
  const albums = new Hono();

  // GET /api/albums — 获取相册列表
  albums.get("/", async (c) => {
    const db = await getDb(c);
    try {
      const list = await listAlbums(db);
      return c.json(list);
    } catch (err) {
      log.error("list albums failed", err);
      return c.json({ error: "加载相册列表失败" }, 500);
    }
  });

  // POST /api/albums — 新建相册
  albums.post("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { title?: string; description?: string; coverStorageKey?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求格式无效" }, 400);
    }

    if (!body.title || !body.title.trim()) {
      return c.json({ error: "相册标题不能为空" }, 400);
    }

    const db = await getDb(c);
    try {
      const albumId = await createAlbum(db, {
        title: body.title,
        description: body.description,
        coverStorageKey: body.coverStorageKey,
        userId: session.userId,
        author: session.author,
      });
      return c.json({ id: albumId });
    } catch (err) {
      log.error("create album failed", err);
      return c.json({ error: "创建相册失败" }, 500);
    }
  });

  // GET /api/albums/:id — 获取单个相册详情及相片
  albums.get("/:id", async (c) => {
    const db = await getDb(c);
    const id = c.req.param("id");
    try {
      const detail = await getAlbum(db, id);
      if (!detail) {
        return c.json({ error: "相册不存在" }, 404);
      }
      return c.json(detail);
    } catch (err) {
      log.error("get album failed", err);
      return c.json({ error: "加载相册详情失败" }, 500);
    }
  });

  // PUT /api/albums/:id — 更新相册信息
  albums.put("/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const id = c.req.param("id");
    if (id === "all") {
      return c.json({ error: "系统相册不可修改" }, 400);
    }

    let body: { title?: string; description?: string; coverStorageKey?: string };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求格式无效" }, 400);
    }

    const db = await getDb(c);
    try {
      await updateAlbum(db, id, body);
      return c.json({ ok: true });
    } catch (err) {
      log.error("update album failed", err);
      return c.json({ error: "更新相册失败" }, 500);
    }
  });

  // DELETE /api/albums/:id — 删除相册
  albums.delete("/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const id = c.req.param("id");
    if (id === "all") {
      return c.json({ error: "系统相册不可删除" }, 400);
    }

    const db = await getDb(c);
    try {
      await deleteAlbum(db, id);
      return c.json({ ok: true });
    } catch (err) {
      log.error("delete album failed", err);
      return c.json({ error: "删除相册失败" }, 500);
    }
  });

  // POST /api/albums/:id/assets — 批量向相册添加照片
  albums.post("/:id/assets", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const id = c.req.param("id");
    if (id === "all") {
      return c.json({ ok: true, added: 0 });
    }

    let body: { assetIds?: string[] };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求格式无效" }, 400);
    }

    if (!Array.isArray(body.assetIds) || body.assetIds.length === 0) {
      return c.json({ error: "请选择要添加的照片" }, 400);
    }

    const db = await getDb(c);
    try {
      const count = await addAssetsToAlbum(db, id, body.assetIds);
      return c.json({ ok: true, added: count });
    } catch (err) {
      log.error("add assets to album failed", err);
      return c.json({ error: "添加照片失败" }, 500);
    }
  });

  // DELETE /api/albums/:id/assets/:assetId — 从相册移除照片
  albums.delete("/:id/assets/:assetId", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const albumId = c.req.param("id");
    if (albumId === "all") {
      return c.json({ error: "系统相册不支持移出照片" }, 400);
    }

    const assetId = c.req.param("assetId");
    const db = await getDb(c);
    try {
      await removeAssetFromAlbum(db, albumId, assetId);
      return c.json({ ok: true });
    } catch (err) {
      log.error("remove asset from album failed", err);
      return c.json({ error: "移除照片失败" }, 500);
    }
  });

  return albums;
}
