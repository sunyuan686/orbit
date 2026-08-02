import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, isNull, asc, desc, sql } from "drizzle-orm";
import { canEditContent, canDeleteContent } from "../content-policies.js";
import { toPlainText, isEmptyBody } from "../lib/plain-text.js";
import { generateId } from "../lib/id.js";
import { getRequestId } from "../lib/request-context.js";
import { loadUserNameMap, resolveUserName } from "../lib/author-present.js";
import {
  authorWriteFields,
  editorWriteFields,
  presentEntryDetail,
  presentMemoDetail,
} from "../lib/article-present.js";
import { entry, memo, comment } from "../db/schema.js";
import { loadCoversForEntries } from "../lib/entry-covers.js";
import {
  snippetFromBody,
  truncateListSnippet,
} from "../lib/list-snippet.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/audit.js";
import { getSpaceUserIds } from "../services/space-authors.js";
import type { SessionAuthor } from "./session-author.js";
import { INVALID_SESSION_ERROR } from "./session-author.js";
import {
  notifyEntryCreated,
  type NotifyRuntime,
} from "../services/notify.js";
import { syncAssetReferences } from "../services/asset-references.js";

type DbProvider = (c: Context) => any | Promise<any>;

const ARTICLES_PAGE_MAX = 100;

export interface ArticleRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getNotifyRuntime?: (c: Context) => NotifyRuntime | undefined;
  waitUntil?: (c: Context, task: Promise<unknown>) => void;
}

function parseOptionalPage(c: Context):
  | { ok: true; paginate: false }
  | { ok: true; paginate: true; limit: number; offset: number }
  | { ok: false; response: Response } {
  const limitRaw = c.req.query("limit");
  const offsetRaw = c.req.query("offset");
  if (limitRaw == null || limitRaw === "") {
    return { ok: true, paginate: false };
  }

  const limitNum = Number(limitRaw);
  const offsetNum = offsetRaw == null || offsetRaw === "" ? 0 : Number(offsetRaw);
  if (!Number.isFinite(limitNum) || limitNum < 1) {
    return { ok: false, response: c.json({ error: "limit 参数无效" }, 400) };
  }
  if (!Number.isFinite(offsetNum) || offsetNum < 0) {
    return { ok: false, response: c.json({ error: "offset 参数无效" }, 400) };
  }

  return {
    ok: true,
    paginate: true,
    limit: Math.min(Math.floor(limitNum), ARTICLES_PAGE_MAX),
    offset: Math.floor(offsetNum),
  };
}

function authorRequiredResponse(c: Context) {
  return c.json({ error: INVALID_SESSION_ERROR }, 400);
}

function bodyRequiredResponse(c: Context) {
  return c.json({ error: "内容不能为空" }, 400);
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: ArticleRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | null | Response> {
  if (!getSessionAuthor) return null;
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return authorRequiredResponse(c);
  return sessionAuthor;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

async function auditArticleWrite(
  c: Context,
  db: any,
  sessionAuthor: SessionAuthor,
  action: string,
  resourceType: string,
  resourceId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await recordAudit(db, {
    userId: sessionAuthor.userId,
    author: sessionAuthor.author,
    action,
    resourceType,
    resourceId,
    metadata,
    requestId: getRequestId(c),
  });
}

function mapEntrySummary(
  row: {
    id: string;
    type: string;
    title: string | null;
    author: string;
    userId: string | null;
    entryDate: number | null;
    createdAt: number;
    parentId: string | null;
    snippetRaw?: string | null;
  },
  nameMap: Map<string, string>,
  covers?: Map<string, string>
) {
  const authorName = resolveUserName(nameMap, row.userId, row.author);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    userId: row.userId,
    author: authorName,
    authorName,
    entryDate: row.entryDate,
    createdAt: row.createdAt,
    parentId: row.parentId,
    snippet: truncateListSnippet(row.snippetRaw),
    coverUrl: covers?.get(row.id) ?? null,
  };
}

export function createArticlesRoutes(getDb: DbProvider, options: ArticleRouteOptions = {}) {
  const { getSessionAuthor, getNotifyRuntime, waitUntil } = options;
  const articles = new Hono();

  // GET /api/articles?type=diary|timeline|message|letter|memo
  // ?status=draft  仅返回当前用户的草稿（需登录）
  // 默认只返回 published；letter 默认只返回主信（parentId=null）；?roots=0 返回全部
  // 无 limit：仍返回数组（兼容）；有 limit：{ items, total, limit, offset }
  articles.get("/", async (c) => {
    const db = await getDb(c);
    const type = c.req.query("type");
    const statusFilter = c.req.query("status"); // 'draft' | undefined
    const rootsOnly = c.req.query("roots") !== "0";
    const page = parseOptionalPage(c);
    if (!page.ok) return page.response;

    // 草稿查询：鉴权后只返回自己的草稿
    if (statusFilter === "draft") {
      const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
      if (sessionResult instanceof Response) return sessionResult;
      const sessionAuthor = sessionResult as SessionAuthor;

      const conditions = [
        isNull(entry.deletedAt),
        eq(entry.status, "draft"),
        eq(entry.userId, sessionAuthor.userId),
      ];
      if (type && type !== "all") {
        conditions.push(eq(entry.type, type));
      }
      const where = and(...conditions);

      const drafts = await db
        .select({
          id: entry.id,
          type: entry.type,
          title: entry.title,
          author: entry.author,
          userId: entry.userId,
          entryDate: entry.entryDate,
          createdAt: entry.createdAt,
          updatedAt: entry.updatedAt,
          parentId: entry.parentId,
          status: entry.status,
          snippetRaw: sql<string>`substr(coalesce(${entry.bodyText}, ''), 1, 160)`,
        })
        .from(entry)
        .where(where)
        .orderBy(desc(entry.updatedAt));

      const nameMap = await loadUserNameMap(
        db,
        drafts.map((e: { userId: string | null }) => e.userId)
      );
      const items = drafts.map((row: any) => ({
        ...mapEntrySummary(row, nameMap),
        status: row.status,
        updatedAt: row.updatedAt,
      }));
      return c.json(items);
    }

    if (type === "memo") {
      const where = isNull(memo.deletedAt);
      const baseQuery = db
        .select({
          id: memo.id,
          key: memo.key,
          title: memo.title,
          author: memo.author,
          userId: memo.userId,
          entryDate: memo.updatedAt,
          bodyPreview: sql<string>`substr(coalesce(${memo.body}, ''), 1, 500)`,
        })
        .from(memo)
        .where(where)
        .orderBy(asc(memo.title));

      const listQuery = page.paginate
        ? baseQuery.limit(page.limit).offset(page.offset)
        : baseQuery;
      const countQuery = page.paginate
        ? db.select({ count: sql<number>`count(*)` }).from(memo).where(where).get()
        : null;

      const [memos, countRow] = await Promise.all([
        listQuery,
        countQuery ?? Promise.resolve(null),
      ]);
      const nameMap = await loadUserNameMap(db, memos.map((m: { userId: string | null }) => m.userId));
      const items = memos.map(
        (m: {
          id: string;
          key: string;
          title: string;
          author: string;
          userId: string | null;
          entryDate: number;
          bodyPreview: string | null;
        }) => {
          const authorName = resolveUserName(nameMap, m.userId, m.author);
          return {
            id: m.id,
            type: "memo",
            key: m.key,
            title: m.title,
            userId: m.userId,
            author: authorName,
            authorName,
            entryDate: m.entryDate,
            parentId: null as string | null,
            snippet: snippetFromBody(m.bodyPreview),
            coverUrl: null as string | null,
          };
        }
      );

      if (!page.paginate) return c.json(items);

      return c.json({
        items,
        total: Number(countRow?.count ?? 0),
        limit: page.limit,
        offset: page.offset,
      });
    }

    // 默认只返回 published
    const conditions = [isNull(entry.deletedAt), eq(entry.status, "published")];
    if (type && type !== "all") {
      conditions.push(eq(entry.type, type));
    }
    if (type === "letter" && rootsOnly) {
      conditions.push(isNull(entry.parentId));
    }
    const where = and(...conditions);

    const baseQuery = db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        author: entry.author,
        userId: entry.userId,
        entryDate: entry.entryDate,
        createdAt: entry.createdAt,
        parentId: entry.parentId,
        snippetRaw: sql<string>`substr(coalesce(${entry.bodyText}, ''), 1, 160)`,
      })
      .from(entry)
      .where(where)
      .orderBy(desc(entry.entryDate), desc(entry.createdAt));

    const listQuery = page.paginate
      ? baseQuery.limit(page.limit).offset(page.offset)
      : baseQuery;
    const countQuery = page.paginate
      ? db.select({ count: sql<number>`count(*)` }).from(entry).where(where).get()
      : null;

    const [entries, countRow] = await Promise.all([
      listQuery,
      countQuery ?? Promise.resolve(null),
    ]);
    const nameMap = await loadUserNameMap(
      db,
      entries.map((e: { userId: string | null }) => e.userId)
    );
    const covers = await loadCoversForEntries(
      db,
      entries.map((e: { id: string }) => e.id)
    );
    const items = entries.map((row: Parameters<typeof mapEntrySummary>[0]) =>
      mapEntrySummary(row, nameMap, covers)
    );

    if (!page.paginate) return c.json(items);

    return c.json({
      items,
      total: Number(countRow?.count ?? 0),
      limit: page.limit,
      offset: page.offset,
    });
  });

  // GET /api/articles/:id/replies — 某封信的回信列表
  articles.get("/:id/replies", async (c) => {
    const db = await getDb(c);
    const parentId = c.req.param("id");

    const replies = await db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        author: entry.author,
        userId: entry.userId,
        entryDate: entry.entryDate,
        createdAt: entry.createdAt,
        parentId: entry.parentId,
      })
      .from(entry)
      .where(and(eq(entry.parentId, parentId), isNull(entry.deletedAt)))
      .orderBy(asc(entry.entryDate), asc(entry.createdAt));

    const nameMap = await loadUserNameMap(db, replies.map((r: { userId: string | null }) => r.userId));
    return c.json(replies.map((row: Parameters<typeof mapEntrySummary>[0]) => mapEntrySummary(row, nameMap)));
  });

  // GET /api/articles/:id
  articles.get("/:id", async (c) => {
    const db = await getDb(c);
    const id = c.req.param("id");

    const memoRow = await db.select().from(memo).where(and(eq(memo.id, id), isNull(memo.deletedAt))).get();

    if (memoRow) {
      return c.json(await presentMemoDetail(db, memoRow));
    }

    const row = await db
      .select()
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!row) return c.json({ error: "not found" }, 404);

    return c.json(await presentEntryDetail(db, row));
  });

  // POST /api/articles — 新建（支持 status: draft | published）
  articles.post("/", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor;

    const { type, title, body, entryDate, parentId, status } = await c.req.json<{
      type: string;
      title?: string;
      body?: string;
      entryDate?: number;
      parentId?: string | null;
      status?: "draft" | "published";
    }>();

    const effectiveStatus: "draft" | "published" =
      status === "draft" ? "draft" : "published";

    if (type === "memo") {
      if (isEmptyBody(body)) return bodyRequiredResponse(c);
      const key = title?.trim() || `memo-${Date.now()}`;
      const id = generateId("mem");
      const bodyValue = body ?? "";
      await db.insert(memo).values({
        id,
        key,
        title: title ?? key,
        body: bodyValue,
        ...authorWriteFields(sessionAuthor),
        updatedAt: now(),
      });
      await syncAssetReferences(db, "memo", id, bodyValue);
      await auditArticleWrite(c, db, sessionAuthor, AuditAction.ARTICLE_CREATE, AuditResourceType.MEMO, id, {
        contentType: type,
        titleLength: title?.length ?? 0,
        bodyLength: bodyValue.length,
      });
      return c.json({ id });
    }

    // 草稿允许空 body（先占位），published 必须有内容
    if (effectiveStatus === "published" && isEmptyBody(body)) {
      return bodyRequiredResponse(c);
    }

    const id = generateId("ent");
    const bodyValue = body ?? "";
    await db.insert(entry).values({
      id,
      type,
      title: title ?? null,
      body: bodyValue,
      bodyText: bodyValue ? toPlainText(bodyValue) : "",
      entryDate: entryDate ?? now(),
      parentId: parentId ?? null,
      status: effectiveStatus,
      createdAt: now(),
      updatedAt: now(),
      ...authorWriteFields(sessionAuthor),
    });
    await syncAssetReferences(db, type, id, bodyValue);
    await auditArticleWrite(c, db, sessionAuthor, AuditAction.ARTICLE_CREATE, AuditResourceType.ENTRY, id, {
      contentType: type,
      status: effectiveStatus,
      titleLength: title?.length ?? 0,
      bodyLength: bodyValue.length,
      entryDate: entryDate ?? null,
      parentId: parentId ?? null,
    });

    // 草稿不触发通知
    if (effectiveStatus === "published") {
      const notifyRuntime = getNotifyRuntime?.(c);
      if (notifyRuntime) {
        const task = notifyEntryCreated(db, notifyRuntime, {
          actorUserId: sessionAuthor.userId,
          actorName: sessionAuthor.author,
          entryId: id,
          entryType: type,
          parentId: parentId ?? null,
          bodyPreview: bodyValue ? toPlainText(bodyValue) : "",
          requestId: getRequestId(c),
        });
        if (waitUntil) waitUntil(c, task);
        else void task.catch(() => undefined);
      }
    }

    return c.json({ id, status: effectiveStatus });
  });

  // PUT /api/articles/:id — 更新（可选附带边注位置重映射、status 发布草稿）
  articles.put("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor;

    const id = c.req.param("id");
    const { title, body, entryDate, commentMappings, status } = await c.req.json<{
      title?: string;
      body?: string;
      entryDate?: number;
      status?: "draft" | "published";
      /** 边注位置重映射数组 */
      commentMappings?: { id: string; anchorFrom: number; anchorTo: number }[];
    }>();

    // 草稿转 published 时才检查 body 非空；单纯更新内容时如果传了 body 且为空也拒绝
    if (status === "published" && isEmptyBody(body)) {
      return bodyRequiredResponse(c);
    }
    if (status !== "published" && body !== undefined && isEmptyBody(body)) {
      return bodyRequiredResponse(c);
    }

    const spaceUserIds = await getSpaceUserIds(db);

    const memoRow = await db
      .select({ id: memo.id, userId: memo.userId })
      .from(memo)
      .where(and(eq(memo.id, id), isNull(memo.deletedAt)))
      .get();
    if (memoRow) {
      if (!canEditContent("memo", memoRow.userId, sessionAuthor.userId, spaceUserIds)) {
        return c.json({ error: "无权编辑此内容" }, 403);
      }
      await db
        .update(memo)
        .set({
          title: title ?? undefined,
          body: body ?? undefined,
          ...editorWriteFields(sessionAuthor),
          updatedAt: now(),
        })
        .where(eq(memo.id, id));
      if (body !== undefined) {
        await syncAssetReferences(db, "memo", id, body);
      }
      await auditArticleWrite(c, db, sessionAuthor, AuditAction.ARTICLE_UPDATE, AuditResourceType.MEMO, id, {
        titleLength: title?.length ?? null,
        bodyLength: body?.length ?? null,
      });
      const updatedMemo = await db.select().from(memo).where(eq(memo.id, id)).get();
      return c.json(await presentMemoDetail(db, updatedMemo!));
    }

    const existing = await db
      .select({ type: entry.type, userId: entry.userId })
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!existing) {
      return c.json({ error: "not found" }, 404);
    }

    if (!canEditContent(existing.type, existing.userId, sessionAuthor.userId, spaceUserIds)) {
      return c.json({ error: "无权编辑此内容" }, 403);
    }

    const entryUpdates: Record<string, unknown> = {
      title: title ?? undefined,
      entryDate: entryDate ?? undefined,
      ...editorWriteFields(sessionAuthor),
      updatedAt: now(),
    };
    if (status === "draft" || status === "published") {
      entryUpdates.status = status;
    }
    if (body !== undefined) {
      entryUpdates.body = body;
      entryUpdates.bodyText = body ? toPlainText(body) : "";
    }

    await db.update(entry).set(entryUpdates).where(eq(entry.id, id));
    if (body !== undefined) {
      await syncAssetReferences(db, existing.type, id, body);
    }

    // 边注位置重映射：校验归属后批量更新
    if (commentMappings && commentMappings.length > 0) {
      const mappingUpdates = [];
      const updatedAt = now();
      for (const mapping of commentMappings) {
        if (
          typeof mapping.id !== "string" ||
          typeof mapping.anchorFrom !== "number" ||
          typeof mapping.anchorTo !== "number" ||
          mapping.anchorFrom < 0 ||
          mapping.anchorTo < 0 ||
          mapping.anchorFrom >= mapping.anchorTo
        ) {
          continue; // 跳过无效条目
        }
        // 仅更新属于本篇文章的 inline 边注
        mappingUpdates.push(
          db
            .update(comment)
            .set({
              anchorFrom: mapping.anchorFrom,
              anchorTo: mapping.anchorTo,
              updatedAt,
            })
            .where(
              and(
                eq(comment.id, mapping.id),
                eq(comment.targetType, "entry"),
                eq(comment.targetId, id),
                eq(comment.kind, "inline"),
                isNull(comment.deletedAt)
              )
            )
        );
      }

      if (mappingUpdates.length > 0) {
        if (typeof db.batch === "function") {
          await db.batch(mappingUpdates);
        } else {
          for (const update of mappingUpdates) {
            await update;
          }
        }
      }
    }

    await auditArticleWrite(c, db, sessionAuthor, AuditAction.ARTICLE_UPDATE, AuditResourceType.ENTRY, id, {
      contentType: existing.type,
      status: status ?? null,
      titleLength: title?.length ?? null,
      bodyLength: body?.length ?? null,
      entryDate: entryDate ?? null,
      commentMappingsCount: commentMappings?.length ?? 0,
    });

    const updatedRow = await db.select().from(entry).where(eq(entry.id, id)).get();
    return c.json(await presentEntryDetail(db, updatedRow!));
  });

  // DELETE /api/articles/:id — 统一软删除（仅作者本人）
  // FTS 索引无需手动清理：external content 模式下物理行仍存在故不可删，
  // 但 search.ts 所有查询均 JOIN 源表并过滤 deleted_at IS NULL，软删除行搜不到。
  articles.delete("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor;

    const id = c.req.param("id");

    const memoRow = await db
      .select({ id: memo.id, userId: memo.userId })
      .from(memo)
      .where(and(eq(memo.id, id), isNull(memo.deletedAt)))
      .get();

    if (memoRow) {
      if (!canDeleteContent(memoRow.userId, sessionAuthor.userId)) {
        return c.json({ error: "只能删除自己创建的内容" }, 403);
      }
      await db.update(memo).set({ deletedAt: now() }).where(eq(memo.id, id));
      await auditArticleWrite(c, db, sessionAuthor, AuditAction.ARTICLE_DELETE, AuditResourceType.MEMO, id, {});
      return c.json({ ok: true });
    }

    const entryRow = await db
      .select({ id: entry.id, type: entry.type, userId: entry.userId, parentId: entry.parentId })
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!entryRow) {
      return c.json({ error: "not found" }, 404);
    }

    if (!canDeleteContent(entryRow.userId, sessionAuthor.userId)) {
      return c.json({ error: "只能删除自己创建的内容" }, 403);
    }

    // letter 主信保护：若已有对方回信，删除会留下孤儿回信，禁止
    if (entryRow.type === "letter" && !entryRow.parentId) {
      const reply = await db
        .select({ id: entry.id })
        .from(entry)
        .where(and(eq(entry.parentId, id), isNull(entry.deletedAt)))
        .get();
      if (reply) {
        return c.json({ error: "该信件已有回信，无法直接删除" }, 400);
      }
    }

    await db.update(entry).set({ deletedAt: now() }).where(eq(entry.id, id));
    await auditArticleWrite(c, db, sessionAuthor, AuditAction.ARTICLE_DELETE, AuditResourceType.ENTRY, id, {
      contentType: entryRow.type,
    });

    return c.json({ ok: true });
  });

  return articles;
}
