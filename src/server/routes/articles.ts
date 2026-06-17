import { Hono } from "hono";
import { eq, and, isNull, asc, desc } from "drizzle-orm";
import { db } from "../../db/index.js";
import { entry, memo } from "../../db/schema.js";

const articles = new Hono();

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

// GET /api/articles?type=diary|timeline|message|letter|memo
// letter 默认只返回主信（parentId=null）；?roots=0 返回全部
articles.get("/", async (c) => {
  const type = c.req.query("type");
  const rootsOnly = c.req.query("roots") !== "0";

  if (type === "memo") {
    const memos = await db
      .select({
        id: memo.id,
        type: memo.key,
        title: memo.title,
        entryDate: memo.updatedAt,
      })
      .from(memo)
      .orderBy(asc(memo.title));

    return c.json(
      memos.map((m) => ({
        id: m.id,
        type: "memo",
        title: m.title,
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
    .where(
      and(
        eq(entry.parentId, parentId),
        isNull(entry.deletedAt)
      )
    )
    .orderBy(asc(entry.entryDate), asc(entry.createdAt));

  return c.json(replies.map(mapEntrySummary));
});

// GET /api/articles/:id
articles.get("/:id", async (c) => {
  const id = c.req.param("id");

  // memo 用 ID 查（memo 表）
  const memoRow = await db
    .select()
    .from(memo)
    .where(eq(memo.id, id))
    .get();

  if (memoRow) {
    return c.json({
      id: memoRow.id,
      type: "memo",
      title: memoRow.title,
      body: memoRow.body ?? "",
      entryDate: memoRow.updatedAt,
    });
  }

  // 普通 entry
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
  const { type, title, body, entryDate, author, parentId } = await c.req.json<{
    type: string;
    title?: string;
    body?: string;
    entryDate?: number;
    author?: string;
    parentId?: string | null;
  }>();

  if (type === "memo") {
    const key = title?.trim() || `memo-${Date.now()}`;
    const id = generateId("mem");
    await db.insert(memo).values({
      id,
      key,
      title: title ?? key,
      body: body ?? "",
      updatedAt: now(),
    });
    return c.json({ id });
  }

  const id = generateId("ent");
  await db.insert(entry).values({
    id,
    type,
    author: author ?? "",
    title: title ?? null,
    body: body ?? "",
    entryDate: entryDate ?? null,
    parentId: parentId ?? null,
    createdAt: now(),
    updatedAt: now(),
  });
  return c.json({ id });
});

// PUT /api/articles/:id — 更新
articles.put("/:id", async (c) => {
  const id = c.req.param("id");
  const { title, body, entryDate, author } = await c.req.json<{
    title?: string;
    body?: string;
    entryDate?: number;
    author?: string;
  }>();

  // 检查是否是 memo
  const memoRow = await db
    .select({ id: memo.id })
    .from(memo)
    .where(eq(memo.id, id))
    .get();

  if (memoRow) {
    await db
      .update(memo)
      .set({
        title: title ?? undefined,
        body: body ?? undefined,
        updatedAt: now(),
      })
      .where(eq(memo.id, id));
    return c.json({ ok: true });
  }

  await db
    .update(entry)
    .set({
      title: title ?? undefined,
      author: author ?? undefined,
      body: body ?? undefined,
      entryDate: entryDate ?? undefined,
      updatedAt: now(),
    })
    .where(eq(entry.id, id));

  return c.json({ ok: true });
});

// DELETE /api/articles/:id — 软删除（memo 是硬删除）
articles.delete("/:id", async (c) => {
  const id = c.req.param("id");

  const memoRow = await db
    .select({ id: memo.id })
    .from(memo)
    .where(eq(memo.id, id))
    .get();

  if (memoRow) {
    await db.delete(memo).where(eq(memo.id, id));
    return c.json({ ok: true });
  }

  await db
    .update(entry)
    .set({ deletedAt: now() })
    .where(eq(entry.id, id));

  return c.json({ ok: true });
});

export { articles };
