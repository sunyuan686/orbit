import { Hono } from "hono";
import type { Context } from "hono";
import { eq, sql, and, isNull } from "drizzle-orm";
import { tags, entry } from "../db/schema.js";
import { createLogger } from "../lib/logger.js";
import { getRequestId } from "../lib/request-context.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/space/audit.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("tags");

export interface TagsRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: TagsRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return c.json({ error: INVALID_SESSION_ERROR }, 400);
  return sessionAuthor;
}

function generateTagId(name: string): string {
  const normalized = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (normalized && normalized.length >= 2) {
    return normalized;
  }
  return `tag_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

export function createTagsRoutes(
  getDb: DbProvider,
  options: TagsRouteOptions = {}
) {
  const router = new Hono();

  // GET /api/tags - 获取全部标签（聚合未删除动态数量）
  router.get("/", async (c) => {
    const db = await getDb(c);
    try {
      const rows = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          sortOrder: tags.sortOrder,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
          count: sql<number>`count(${entry.id})`.mapWith(Number),
        })
        .from(tags)
        .leftJoin(
          entry,
          and(eq(entry.tag, tags.id), isNull(entry.deletedAt))
        )
        .groupBy(tags.id)
        .orderBy(tags.sortOrder, tags.createdAt);

      return c.json(rows);
    } catch (err) {
      log.error("list tags failed", err);
      return c.json({ error: "获取标签列表失败" }, 500);
    }
  });

  // POST /api/tags - 新增标签
  router.post("/", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    let body: { id?: string; name?: string; color?: string; sortOrder?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求格式无效" }, 400);
    }

    const name = body.name?.trim();
    if (!name) {
      return c.json({ error: "标签名称不能为空" }, 400);
    }
    if (name.length > 30) {
      return c.json({ error: "标签名称不能超过 30 个字符" }, 400);
    }

    const tagId = (body.id?.trim() || generateTagId(name)).toLowerCase();
    const color = body.color?.trim() || "amber";
    const now = Math.floor(Date.now() / 1000);

    const db = await getDb(c);
    try {
      // 检查 ID 重复
      const existing = await db
        .select({ id: tags.id })
        .from(tags)
        .where(eq(tags.id, tagId))
        .get();

      if (existing) {
        return c.json({ error: `标签标识 "${tagId}" 已存在` }, 409);
      }

      // 默认排序放到最后
      let sortOrder = body.sortOrder;
      if (sortOrder === undefined) {
        const maxSortRow = await db
          .select({ maxSort: sql<number>`max(${tags.sortOrder})` })
          .from(tags)
          .get();
        sortOrder = (maxSortRow?.maxSort ?? 0) + 1;
      }

      await db.insert(tags).values({
        id: tagId,
        name,
        color,
        sortOrder,
        createdAt: now,
        updatedAt: now,
      });

      await recordAudit(db, {
        userId: session.userId,
        author: session.author,
        action: AuditAction.SETTINGS_UPDATE,
        resourceType: AuditResourceType.SETTINGS,
        resourceId: `tag:${tagId}`,
        metadata: { tagId, name, color },
        requestId: getRequestId(c),
      });

      return c.json(
        {
          id: tagId,
          name,
          color,
          sortOrder,
          count: 0,
          createdAt: now,
          updatedAt: now,
        },
        201
      );
    } catch (err) {
      log.error("create tag failed", err);
      return c.json({ error: "创建标签失败" }, 500);
    }
  });

  // PUT /api/tags/:id - 修改标签
  router.put("/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const id = c.req.param("id");
    let body: { name?: string; color?: string; sortOrder?: number };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "请求格式无效" }, 400);
    }

    const db = await getDb(c);
    try {
      const existing = await db
        .select()
        .from(tags)
        .where(eq(tags.id, id))
        .get();

      if (!existing) {
        return c.json({ error: "标签不存在" }, 404);
      }

      const updates: Partial<typeof tags.$inferInsert> = {
        updatedAt: Math.floor(Date.now() / 1000),
      };

      if (body.name !== undefined) {
        const trimmed = body.name.trim();
        if (!trimmed) {
          return c.json({ error: "标签名称不能为空" }, 400);
        }
        if (trimmed.length > 30) {
          return c.json({ error: "标签名称不能超过 30 个字符" }, 400);
        }
        updates.name = trimmed;
      }

      if (body.color !== undefined) {
        const trimmed = body.color.trim();
        if (trimmed) updates.color = trimmed;
      }

      if (body.sortOrder !== undefined && typeof body.sortOrder === "number") {
        updates.sortOrder = body.sortOrder;
      }

      await db.update(tags).set(updates).where(eq(tags.id, id));

      await recordAudit(db, {
        userId: session.userId,
        author: session.author,
        action: AuditAction.SETTINGS_UPDATE,
        resourceType: AuditResourceType.SETTINGS,
        resourceId: `tag:${id}`,
        metadata: { tagId: id, updates },
        requestId: getRequestId(c),
      });

      const updated = await db
        .select({
          id: tags.id,
          name: tags.name,
          color: tags.color,
          sortOrder: tags.sortOrder,
          createdAt: tags.createdAt,
          updatedAt: tags.updatedAt,
          count: sql<number>`count(${entry.id})`.mapWith(Number),
        })
        .from(tags)
        .leftJoin(
          entry,
          and(eq(entry.tag, tags.id), isNull(entry.deletedAt))
        )
        .where(eq(tags.id, id))
        .groupBy(tags.id)
        .get();

      return c.json(updated);
    } catch (err) {
      log.error("update tag failed", err);
      return c.json({ error: "更新标签失败" }, 500);
    }
  });

  // DELETE /api/tags/:id - 删除标签
  router.delete("/:id", async (c) => {
    const session = await requireSessionAuthor(c, options.getSessionAuthor);
    if (session instanceof Response) return session;

    const id = c.req.param("id");
    const db = await getDb(c);

    try {
      const existing = await db
        .select()
        .from(tags)
        .where(eq(tags.id, id))
        .get();

      if (!existing) {
        return c.json({ error: "标签不存在" }, 404);
      }

      await db.delete(tags).where(eq(tags.id, id));

      await recordAudit(db, {
        userId: session.userId,
        author: session.author,
        action: AuditAction.SETTINGS_UPDATE,
        resourceType: AuditResourceType.SETTINGS,
        resourceId: `tag:${id}`,
        metadata: { tagId: id, name: existing.name },
        requestId: getRequestId(c),
      });

      return c.json({ success: true });
    } catch (err) {
      log.error("delete tag failed", err);
      return c.json({ error: "删除标签失败" }, 500);
    }
  });

  return router;
}
