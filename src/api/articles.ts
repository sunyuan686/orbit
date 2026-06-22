import { Hono } from "hono";
import type { Context } from "hono";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { resolveAuthorForWrite, type CanonicalAuthor } from "../authors.js";
import { toPlainText, isEmptyBody } from "../lib/plain-text.js";
import { entry, memo } from "../db/schema.js";
import type { SessionAuthor } from "./session-author.js";

type DbProvider = (c: Context) => any | Promise<any>;

export interface ArticleRouteOptions {
  getSessionAuthor?: (c: Context) => Promise<SessionAuthor | null>;
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

function logWrite(action: string, details: Record<string, unknown>) {
  const now = new Date();
  const stamp =
    `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}` +
    ` ${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  console.info(`${stamp} [write:${action}]`, details);
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
  const { getSessionAuthor } = options;
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
        body: memoRow.body ?? "",
        entryDate: memoRow.updatedAt,
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
        updatedAt: now(),
      });
      logWrite("article.create", {
        id,
        type,
        author,
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
      title: title ?? null,
      body: bodyValue,
      bodyText: bodyValue ? toPlainText(bodyValue) : "",
      entryDate: entryDate ?? now(),
      parentId: parentId ?? null,
      createdAt: now(),
      updatedAt: now(),
    });
    logWrite("article.create", {
      id,
      type,
      author,
      titleLength: title?.length ?? 0,
      bodyLength: bodyValue.length,
      entryDate: entryDate ?? null,
      parentId: parentId ?? null,
    });
    return c.json({ id });
  });

  // PUT /api/articles/:id — 更新
  articles.put("/:id", async (c) => {
    const db = await getDb(c);
    const sessionResult = await requireSessionAuthor(c, getSessionAuthor);
    if (sessionResult instanceof Response) return sessionResult;
    const sessionAuthor = sessionResult as SessionAuthor | null;

    const id = c.req.param("id");
    const { title, body, entryDate } = await c.req.json<{
      title?: string;
      body?: string;
      entryDate?: number;
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
      await db
        .update(memo)
        .set({
          title: title ?? undefined,
          body: body ?? undefined,
          author: resolveAuthorForWrite(memoRow.author, author),
          updatedAt: now(),
        })
        .where(eq(memo.id, id));
      logWrite("article.update", {
        id,
        type: "memo",
        author,
        titleLength: title?.length ?? null,
        bodyLength: body?.length ?? null,
      });
      return c.json({ ok: true });
    }

    const existing = await db
      .select({ author: entry.author })
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!existing) {
      logWrite("article.update.miss", { id, type: "entry" });
      return c.json({ error: "not found" }, 404);
    }

    const entryUpdates: Record<string, unknown> = {
      title: title ?? undefined,
      author: resolveAuthorForWrite(existing?.author, author),
      entryDate: entryDate ?? undefined,
      userId: sessionAuthor!.userId,
      updatedAt: now(),
    };
    if (body !== undefined) {
      entryUpdates.body = body;
      entryUpdates.bodyText = body ? toPlainText(body) : "";
    }

    await db.update(entry).set(entryUpdates).where(eq(entry.id, id));
    logWrite("article.update", {
      id,
      type: "entry",
      author,
      titleLength: title?.length ?? null,
      bodyLength: body?.length ?? null,
      entryDate: entryDate ?? null,
    });

    return c.json({ ok: true });
  });

  // DELETE /api/articles/:id — 统一软删除
  // FTS 索引无需手动清理：external content 模式下物理行仍存在故不可删，
  // 但 search.ts 所有查询均 JOIN 源表并过滤 deleted_at IS NULL，软删除行搜不到。
  articles.delete("/:id", async (c) => {
    const db = await getDb(c);
    const id = c.req.param("id");

    const memoRow = await db
      .select({ id: memo.id })
      .from(memo)
      .where(and(eq(memo.id, id), isNull(memo.deletedAt)))
      .get();

    if (memoRow) {
      await db.update(memo).set({ deletedAt: now() }).where(eq(memo.id, id));
      logWrite("article.delete", { id, type: "memo" });
      return c.json({ ok: true });
    }

    const entryRow = await db
      .select({ id: entry.id })
      .from(entry)
      .where(and(eq(entry.id, id), isNull(entry.deletedAt)))
      .get();

    if (!entryRow) {
      return c.json({ error: "not found" }, 404);
    }

    await db.update(entry).set({ deletedAt: now() }).where(eq(entry.id, id));
    logWrite("article.delete", { id, type: "entry" });

    return c.json({ ok: true });
  });

  return articles;
}
