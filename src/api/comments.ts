import { Hono } from "hono";
import type { Context } from "hono";
import { and, asc, eq, isNull } from "drizzle-orm";
import { INVALID_SESSION_ERROR } from "./session-author.js";
import { canComment, type CommentKind } from "../comment-capabilities.js";
import { comment, entry, memo } from "../db/schema.js";
import { getRequestId } from "../lib/request-context.js";
import { generateId } from "../lib/id.js";
import {
  AuditAction,
  AuditResourceType,
  recordAudit,
} from "../services/audit.js";
import type { SessionAuthor } from "./session-author.js";
import {
  notifyCommentCreated,
  type NotifyRuntime,
} from "../services/notify.js";

type DbProvider = (c: Context) => any | Promise<any>;
type TargetType = "entry" | "memo";

export interface CommentRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
  getNotifyRuntime?: (c: Context) => NotifyRuntime | undefined;
  waitUntil?: (c: Context, task: Promise<unknown>) => void;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function authorRequiredResponse(c: Context) {
  return c.json({ error: INVALID_SESSION_ERROR }, 400);
}

async function requireSessionAuthor(
  c: Context,
  getSessionAuthor?: CommentRouteOptions["getSessionAuthor"]
): Promise<SessionAuthor | Response> {
  if (!getSessionAuthor) return c.json({ error: "Unauthorized" }, 401);
  const sessionAuthor = await getSessionAuthor(c);
  if (!sessionAuthor) return authorRequiredResponse(c);
  return sessionAuthor;
}

function mapComment(row: {
  id: string;
  targetType: string;
  targetId: string;
  kind: string;
  author: string;
  body: string;
  quote: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
  anchorPrefix: string | null;
  anchorSuffix: string | null;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}) {
  return {
    id: row.id,
    targetType: row.targetType,
    targetId: row.targetId,
    kind: row.kind,
    author: row.author || null,
    body: row.body,
    quote: row.quote,
    anchorFrom: row.anchorFrom,
    anchorTo: row.anchorTo,
    anchorPrefix: row.anchorPrefix,
    anchorSuffix: row.anchorSuffix,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

async function resolveContentType(db: any, targetType: TargetType, targetId: string): Promise<string | null> {
  if (targetType === "memo") {
    const row = await db
      .select({ id: memo.id })
      .from(memo)
      .where(and(eq(memo.id, targetId), isNull(memo.deletedAt)))
      .get();
    return row ? "memo" : null;
  }

  const row = await db
    .select({ type: entry.type })
    .from(entry)
    .where(and(eq(entry.id, targetId), isNull(entry.deletedAt)))
    .get();
  return row?.type ?? null;
}

function normalizeTargetType(value: string | undefined | null): TargetType | null {
  if (value === "entry" || value === "memo") return value;
  return null;
}

function normalizeKind(value: string | undefined | null): CommentKind | null {
  if (value === "bottom" || value === "inline") return value;
  return null;
}

async function auditCommentWrite(
  c: Context,
  db: any,
  sessionAuthor: SessionAuthor,
  action: string,
  commentId: string,
  metadata: Record<string, unknown>
): Promise<void> {
  await recordAudit(db, {
    userId: sessionAuthor.userId,
    author: sessionAuthor.author,
    action,
    resourceType: AuditResourceType.COMMENT,
    resourceId: commentId,
    metadata,
    requestId: getRequestId(c),
  });
}

export function createCommentsRoutes(getDb: DbProvider, options: CommentRouteOptions = {}) {
  const { getSessionAuthor, getNotifyRuntime, waitUntil } = options;
  const comments = new Hono();

  comments.get("/", async (c) => {
    const db = await getDb(c);
    const targetType = normalizeTargetType(c.req.query("targetType"));
    const targetId = c.req.query("targetId");

    if (!targetType || !targetId) {
      return c.json({ error: "targetType 和 targetId 必填" }, 400);
    }

    const rows = await db
      .select({
        id: comment.id,
        targetType: comment.targetType,
        targetId: comment.targetId,
        kind: comment.kind,
        userId: comment.userId,
        author: comment.author,
        body: comment.body,
        quote: comment.quote,
        anchorFrom: comment.anchorFrom,
        anchorTo: comment.anchorTo,
        anchorPrefix: comment.anchorPrefix,
        anchorSuffix: comment.anchorSuffix,
        parentId: comment.parentId,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt,
      })
      .from(comment)
      .where(
        and(
          eq(comment.targetType, targetType),
          eq(comment.targetId, targetId),
          isNull(comment.deletedAt)
        )
      )
      .orderBy(asc(comment.createdAt));

    const mapped = rows.map(mapComment);
    return c.json({
      bottom: mapped.filter((item: ReturnType<typeof mapComment>) => item.kind === "bottom"),
      inline: mapped.filter((item: ReturnType<typeof mapComment>) => item.kind === "inline"),
    });
  });

  comments.post("/", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult;

    const payload = await c.req.json<{
      targetType?: string;
      targetId?: string;
      kind?: string;
      body?: string;
      quote?: string;
      anchorFrom?: number;
      anchorTo?: number;
      anchorPrefix?: string;
      anchorSuffix?: string;
      parentId?: string | null;
    }>();

    const targetType = normalizeTargetType(payload.targetType);
    const kind = normalizeKind(payload.kind);
    const targetId = payload.targetId?.trim();
    const body = payload.body?.trim();

    if (!targetType || !targetId || !kind || !body) {
      return c.json({ error: "评论内容不完整" }, 400);
    }

    const contentType = await resolveContentType(db, targetType, targetId);
    if (!contentType) return c.json({ error: "评论目标不存在" }, 404);
    if (!canComment(contentType, kind)) {
      return c.json({ error: "当前内容类型不支持这种评论" }, 400);
    }

    if (kind === "inline") {
      if (
        typeof payload.anchorFrom !== "number" ||
        typeof payload.anchorTo !== "number" ||
        payload.anchorFrom >= payload.anchorTo ||
        !payload.quote?.trim()
      ) {
        return c.json({ error: "选中评论需要有效的文本范围" }, 400);
      }
      // 截断 prefix/suffix 到 50 字符防止滥用
      if (payload.anchorPrefix) {
        payload.anchorPrefix = payload.anchorPrefix.trim().slice(-50);
      }
      if (payload.anchorSuffix) {
        payload.anchorSuffix = payload.anchorSuffix.trim().slice(0, 50);
      }
    }

    if (kind === "bottom" && payload.parentId) {
      const parent = await db
        .select({
          id: comment.id,
          kind: comment.kind,
          targetType: comment.targetType,
          targetId: comment.targetId,
        })
        .from(comment)
        .where(and(eq(comment.id, payload.parentId), isNull(comment.deletedAt)))
        .get();

      if (
        !parent ||
        parent.kind !== "bottom" ||
        parent.targetType !== targetType ||
        parent.targetId !== targetId
      ) {
        return c.json({ error: "回复的评论不存在" }, 400);
      }
    }

    const id = generateId("cmt");
    await db.insert(comment).values({
      id,
      targetType,
      targetId,
      kind,
      userId: sessionAuthor.userId,
      author: sessionAuthor.author,
      body,
      quote: kind === "inline" ? payload.quote!.trim() : null,
      anchorFrom: kind === "inline" ? payload.anchorFrom : null,
      anchorTo: kind === "inline" ? payload.anchorTo : null,
      anchorPrefix: kind === "inline" ? payload.anchorPrefix?.slice(-50) ?? null : null,
      anchorSuffix: kind === "inline" ? payload.anchorSuffix?.slice(0, 50) ?? null : null,
      parentId: kind === "bottom" ? payload.parentId ?? null : null,
      createdAt: now(),
      updatedAt: now(),
    });

    await auditCommentWrite(c, db, sessionAuthor, AuditAction.COMMENT_CREATE, id, {
      targetType,
      targetId,
      kind,
      contentType,
    });

    const notifyRuntime = getNotifyRuntime?.(c);
    if (notifyRuntime) {
      const task = notifyCommentCreated(db, notifyRuntime, {
        actorUserId: sessionAuthor.userId,
        actorName: sessionAuthor.author,
        commentId: id,
        targetType,
        targetId,
        kind,
        body,
        contentType,
        requestId: getRequestId(c),
      });
      if (waitUntil) waitUntil(c, task);
      else void task.catch(() => undefined);
    }

    return c.json({ id });
  });

  comments.put("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult;

    const id = c.req.param("id");
    const { body } = await c.req.json<{ body?: string }>();
    const nextBody = body?.trim();
    if (!nextBody) return c.json({ error: "评论内容不能为空" }, 400);

    const existing = await db
      .select({
        userId: comment.userId,
        author: comment.author,
        targetType: comment.targetType,
        targetId: comment.targetId,
        kind: comment.kind,
      })
      .from(comment)
      .where(and(eq(comment.id, id), isNull(comment.deletedAt)))
      .get();
    if (!existing) return c.json({ error: "评论不存在或已删除" }, 404);
    if (existing.userId !== sessionAuthor.userId) {
      return c.json({ error: "只能编辑自己的评论" }, 403);
    }

    await db
      .update(comment)
      .set({ body: nextBody, updatedAt: now() })
      .where(and(eq(comment.id, id), eq(comment.userId, sessionAuthor.userId), isNull(comment.deletedAt)));

    await auditCommentWrite(c, db, sessionAuthor, AuditAction.COMMENT_UPDATE, id, {
      targetType: existing.targetType,
      targetId: existing.targetId,
      kind: existing.kind,
      bodyLength: nextBody.length,
    });

    return c.json({ ok: true });
  });

  comments.delete("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult;

    const id = c.req.param("id");

    const existing = await db
      .select({
        userId: comment.userId,
        author: comment.author,
        targetType: comment.targetType,
        targetId: comment.targetId,
        kind: comment.kind,
      })
      .from(comment)
      .where(and(eq(comment.id, id), isNull(comment.deletedAt)))
      .get();
    if (!existing) return c.json({ error: "评论不存在或已删除" }, 404);
    if (existing.userId !== sessionAuthor.userId) {
      return c.json({ error: "只能删除自己的评论" }, 403);
    }

    await db
      .update(comment)
      .set({ deletedAt: now(), updatedAt: now() })
      .where(and(eq(comment.id, id), eq(comment.userId, sessionAuthor.userId), isNull(comment.deletedAt)));

    await auditCommentWrite(c, db, sessionAuthor, AuditAction.COMMENT_DELETE, id, {
      targetType: existing.targetType,
      targetId: existing.targetId,
      kind: existing.kind,
    });

    return c.json({ ok: true });
  });

  return comments;
}
