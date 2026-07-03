import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { resolveAuthorForWrite, type CanonicalAuthor } from "../authors.js";
import { canEditContent, canDeleteContent } from "../content-policies.js";
import { toPlainText, isEmptyBody } from "../lib/plain-text.js";
import { getRequestId } from "../lib/request-context.js";
import { entry, memo, comment } from "../db/schema.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/audit.js";
import type { SessionAuthor } from "./session-author.js";
import {
  notifyEntryCreated,
  type NotifyRuntime,
} from "../services/notify.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface ArticleRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getNotifyRuntime?: (c: Context) => NotifyRuntime | undefined;
  waitUntil?: (c: Context, task: Promise<unknown>) => void;
}

function authorRequiredResponse(c: Context) {
  return c.json(
    { error: "账号身份无效，请使用「小圆子」或「小麟子」注册/登录" },
    400
  );
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

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `${prefix}_${suffix}`;
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

function mapEntrySummary(row: {
  id: string;
  type: string;
  title: string | null;
  author: string;
  entryDate: number | null;
  createdAt: number;
  parentId: string | null;
}) {
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    author: row.author || null,
    entryDate: row.entryDate,
    createdAt: row.createdAt,
    parentId: row.parentId,
  };
}

export function createArticlesRoutes(getDb: DbProvider, options: ArticleRouteOptions = {}) {
  const { getSessionAuthor, getNotifyRuntime, waitUntil } = options;
  const articles = new Hono();

  // GET /api/articles?type=diary|timeline|message|letter|memo
  // letter 默认只返回主信（parentId=null）；?roots=0 返回全部
  articles.get("/", async (c) => {
    const db = await getDb(c);
    const type = c.req.query("type");
    const rootsOnly = c.req.query("roots") !== "0";

    if (type === "memo") {
      const memos = await db
        .select({
          id: memo.id,
          type: memo.key,
          title: memo.title,
          author: memo.author,
          entryDate: memo.updatedAt,
        })
        .from(memo)
        .where(isNull(memo.deletedAt))
        .orderBy(asc(memo.title));

      return c.json(
        memos.map((m: { id: string; title: string; author: string; entryDate: number }) => ({
          id: m.id,
          type: "memo",
          title: m.title,
          author: m.author || null,
          entryDate: m.entryDate,
        }))
      );
    }

    const conditions = [isNull(entry.deletedAt)];
    if (type && type !== "all") {
      conditions.push(eq(entry.type, type));
    }
    if (type === "letter" && rootsOnly) {
      conditions.push(isNull(entry.parentId));
    }

    const entries = await db
      .select({
        id: entry.id,
        type: entry.type,
        title: entry.title,
        author: entry.author,
        entryDate: entry.entryDate,
        createdAt: entry.createdAt,
        parentId: entry.parentId,
      })
      .from(entry)
      .where(and(...conditions))
      .orderBy(desc(entry.entryDate), desc(entry.createdAt));

    return c.json(entries.map(mapEntrySummary));
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
        entryDate: entry.entryDate,
        createdAt: entry.createdAt,
        parentId: entry.parentId,
      })
      .from(entry)
      .where(and(eq(entry.parentId, parentId), isNull(entry.deletedAt)))
      .orderBy(asc(entry.entryDate), asc(entry.createdAt));

    return c.json(replies.map(mapEntrySummary));
  });

  // GET /api/articles/:id
  articles.get("/:id", async (c) => {
    const db = await getDb(c);
    const id = c.req.param("id");

    const memoRow = await db.select().from(memo).where(and(eq(memo.id, id), isNull(memo.deletedAt))).get();

    if (memoRow) {
      return c.json({
        id: memoRow.id,
        type: "memo",
        title: memoRow.title,
        author: memoRow.author || null,
        modifiedBy: memoRow.modifiedBy || memoRow.author || null,
        body: memoRow.body ?? "",
        entryDate: null,
        createdAt: memoRow.createdAt,
        updatedAt: memoRow.updatedAt,
      });
    }

    const row = await db
      .select()
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!row) return c.json({ error: "not found" }, 404);

    return c.json({
      id: row.id,
      type: row.type,
      title: row.title,
      author: row.author || null,
      modifiedBy: row.modifiedBy || row.author || null,
      body: row.body ?? "",
      entryDate: row.entryDate,
      parentId: row.parentId,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    });
  });

  // POST /api/articles — 新建
  articles.post("/", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor | null;

    const { type, title, body, entryDate, parentId } = await c.req.json<{
      type: string;
      title?: string;
      body?: string;
      entryDate?: number;
      parentId?: string | null;
    }>();

    const author = sessionAuthor?.author as CanonicalAuthor | undefined;

    if (type === "memo") {
      if (!author) return authorRequiredResponse(c);
      if (isEmptyBody(body)) return bodyRequiredResponse(c);
      const key = title?.trim() || `memo-${Date.now()}`;
      const id = generateId("mem");
      await db.insert(memo).values({
        id,
        key,
        title: title ?? key,
        body: body ?? "",
        author,
        modifiedBy: author,
        updatedAt: now(),
      });
      await auditArticleWrite(c, db, sessionAuthor!, AuditAction.ARTICLE_CREATE, AuditResourceType.MEMO, id, {
        contentType: type,
        titleLength: title?.length ?? 0,
        bodyLength: body?.length ?? 0,
      });
      return c.json({ id });
    }

    if (!author) return authorRequiredResponse(c);
    if (isEmptyBody(body)) return bodyRequiredResponse(c);

    const id = generateId("ent");
    const bodyValue = body ?? "";
    await db.insert(entry).values({
      id,
      type,
      userId: sessionAuthor!.userId,
      author,
      modifiedBy: author,
      title: title ?? null,
      body: bodyValue,
      bodyText: bodyValue ? toPlainText(bodyValue) : "",
      entryDate: entryDate ?? now(),
      parentId: parentId ?? null,
      createdAt: now(),
      updatedAt: now(),
    });
    await auditArticleWrite(c, db, sessionAuthor!, AuditAction.ARTICLE_CREATE, AuditResourceType.ENTRY, id, {
      contentType: type,
      titleLength: title?.length ?? 0,
      bodyLength: bodyValue.length,
      entryDate: entryDate ?? null,
      parentId: parentId ?? null,
    });

    const notifyRuntime = getNotifyRuntime?.(c);
    if (notifyRuntime && sessionAuthor) {
      const task = notifyEntryCreated(db, notifyRuntime, {
        actor: sessionAuthor.author as CanonicalAuthor,
        entryId: id,
        entryType: type,
        parentId: parentId ?? null,
        bodyPreview: bodyValue ? toPlainText(bodyValue) : "",
        requestId: getRequestId(c),
      });
      if (waitUntil) waitUntil(c, task);
      else void task.catch(() => undefined);
    }

    return c.json({ id });
  });

  // PUT /api/articles/:id — 更新（可选附带边注位置重映射）
  articles.put("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor | null;

    const id = c.req.param("id");
    const { title, body, entryDate, commentMappings } = await c.req.json<{
      title?: string;
      body?: string;
      entryDate?: number;
      /** 边注位置重映射数组 */
      commentMappings?: { id: string; anchorFrom: number; anchorTo: number }[];
    }>();

    const author = sessionAuthor?.author as CanonicalAuthor | undefined;
    if (!author) return authorRequiredResponse(c);
    // 传了 body 且为空时拒绝；未传 body 视为不修改（如只改标题）
    if (body !== undefined && isEmptyBody(body)) {
      return bodyRequiredResponse(c);
    }

    const memoRow = await db
      .select({ id: memo.id, author: memo.author })
      .from(memo)
      .where(and(eq(memo.id, id), isNull(memo.deletedAt)))
      .get();
    if (memoRow) {
      if (!canEditContent("memo", memoRow.author, author)) {
        return c.json({ error: "无权编辑此内容" }, 403);
      }
      await db
        .update(memo)
        .set({
          title: title ?? undefined,
          body: body ?? undefined,
          author: resolveAuthorForWrite(memoRow.author, author),
          modifiedBy: author,
          updatedAt: now(),
        })
        .where(eq(memo.id, id));
      await auditArticleWrite(c, db, sessionAuthor!, AuditAction.ARTICLE_UPDATE, AuditResourceType.MEMO, id, {
        titleLength: title?.length ?? null,
        bodyLength: body?.length ?? null,
      });
      return c.json({ ok: true });
    }

    const existing = await db
      .select({ author: entry.author, type: entry.type })
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!existing) {
      return c.json({ error: "not found" }, 404);
    }

    if (!canEditContent(existing.type, existing.author, author)) {
      return c.json({ error: "无权编辑此内容" }, 403);
    }

    const entryUpdates: Record<string, unknown> = {
      title: title ?? undefined,
      author: resolveAuthorForWrite(existing?.author, author),
      modifiedBy: author,
      entryDate: entryDate ?? undefined,
      userId: sessionAuthor!.userId,
      updatedAt: now(),
    };
    if (body !== undefined) {
      entryUpdates.body = body;
      entryUpdates.bodyText = body ? toPlainText(body) : "";
    }

    await db.update(entry).set(entryUpdates).where(eq(entry.id, id));

    // 边注位置重映射：校验归属后批量更新
    if (commentMappings && commentMappings.length > 0) {
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
        await db
          .update(comment)
          .set({
            anchorFrom: mapping.anchorFrom,
            anchorTo: mapping.anchorTo,
            updatedAt: now(),
          })
          .where(
            and(
              eq(comment.id, mapping.id),
              eq(comment.targetType, "entry"),
              eq(comment.targetId, id),
              eq(comment.kind, "inline"),
              isNull(comment.deletedAt)
            )
          );
      }
    }

    await auditArticleWrite(c, db, sessionAuthor!, AuditAction.ARTICLE_UPDATE, AuditResourceType.ENTRY, id, {
      contentType: existing.type,
      titleLength: title?.length ?? null,
      bodyLength: body?.length ?? null,
      entryDate: entryDate ?? null,
      commentMappingsCount: commentMappings?.length ?? 0,
    });

    return c.json({ ok: true });
  });

  // DELETE /api/articles/:id — 统一软删除（仅作者本人）
  // FTS 索引无需手动清理：external content 模式下物理行仍存在故不可删，
  // 但 search.ts 所有查询均 JOIN 源表并过滤 deleted_at IS NULL，软删除行搜不到。
  articles.delete("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor | null;

    const author = sessionAuthor?.author as CanonicalAuthor | undefined;
    if (!author) return authorRequiredResponse(c);

    const id = c.req.param("id");

    const memoRow = await db
      .select({ id: memo.id, author: memo.author })
      .from(memo)
      .where(and(eq(memo.id, id), isNull(memo.deletedAt)))
      .get();

    if (memoRow) {
      if (!canDeleteContent(memoRow.author, author)) {
        return c.json({ error: "只能删除自己创建的内容" }, 403);
      }
      await db.update(memo).set({ deletedAt: now() }).where(eq(memo.id, id));
      await auditArticleWrite(c, db, sessionAuthor!, AuditAction.ARTICLE_DELETE, AuditResourceType.MEMO, id, {});
      return c.json({ ok: true });
    }

    const entryRow = await db
      .select({ id: entry.id, type: entry.type, author: entry.author, parentId: entry.parentId })
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!entryRow) {
      return c.json({ error: "not found" }, 404);
    }

    if (!canDeleteContent(entryRow.author, author)) {
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
    await auditArticleWrite(c, db, sessionAuthor!, AuditAction.ARTICLE_DELETE, AuditResourceType.ENTRY, id, {
      contentType: entryRow.type,
    });

    return c.json({ ok: true });
  });

  return articles;
}
