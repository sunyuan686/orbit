/**
 * Cloudflare Workers 入口（Phase 4 使用）
 *
 * 与 src/server/index.ts（Node.js 开发版）相对应。
 * 关键差异：
 *   - DB：D1Database binding 替代 better-sqlite3
 *   - 存储：R2 binding 替代本地 fs
 *   - 静态资源：Workers Assets 替代 serveStatic
 *   - 入口：export default 替代 serve()
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema.js";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError } from "better-auth/api";
import { eq, and, isNull, asc, desc } from "drizzle-orm";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

type HonoEnv = { Bindings: Env };

const MAX_USERS = 2;

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `${prefix}_${suffix}`;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

const app = new Hono<HonoEnv>();

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// ─── Auth ────────────────────────────────────────────────────────────────────

function createAuth(db: ReturnType<typeof drizzle<typeof schema>>, secret: string, baseUrl: string) {
  return betterAuth({
    secret,
    baseURL: baseUrl,
    database: drizzleAdapter(db, {
      provider: "sqlite",
      schema: {
        user: schema.user,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    session: { expiresIn: 60 * 60 * 24 * 30, updateAge: 60 * 60 * 24 },
    databaseHooks: {
      user: {
        create: {
          before: async (userData) => {
            const existing = await db
              .select({ id: schema.user.id })
              .from(schema.user)
              .limit(MAX_USERS);
            if (existing.length >= MAX_USERS) {
              throw new APIError("FORBIDDEN", {
                message: "Registration is closed. This space is just for two.",
              });
            }
            return { data: userData };
          },
        },
      },
    },
  });
}

app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  return auth.handler(c.req.raw);
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(c: Parameters<Parameters<typeof app.use>[0]>[0], next: () => Promise<void>) {
  const db = drizzle(c.env.DB, { schema });
  const auth = createAuth(db, c.env.BETTER_AUTH_SECRET, c.env.BETTER_AUTH_URL);
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return next();
}

app.use("/api/articles/*", async (c, next) => {
  if (c.req.method === "GET") return next();
  return requireAuth(c, next);
});

app.use("/api/articles", async (c, next) => {
  if (c.req.method === "GET") return next();
  return requireAuth(c, next);
});

app.use("/api/assets/*", requireAuth);

// ─── Articles routes ──────────────────────────────────────────────────────────

app.get("/api/articles", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const type = c.req.query("type");

  if (type === "memo") {
    const memos = await db.select().from(schema.memo).orderBy(asc(schema.memo.title));
    return c.json(memos.map((m) => ({ id: m.id, type: "memo", title: m.title, entryDate: m.updatedAt })));
  }

  const conditions = [isNull(schema.entry.deletedAt)];
  if (type && type !== "all") conditions.push(eq(schema.entry.type, type));

  const entries = await db
    .select({ id: schema.entry.id, type: schema.entry.type, title: schema.entry.title, entryDate: schema.entry.entryDate, createdAt: schema.entry.createdAt })
    .from(schema.entry)
    .where(and(...conditions))
    .orderBy(desc(schema.entry.entryDate), desc(schema.entry.createdAt));

  return c.json(entries);
});

app.get("/api/articles/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = c.req.param("id");

  const memoRow = await db.select().from(schema.memo).where(eq(schema.memo.id, id)).get();
  if (memoRow) return c.json({ id: memoRow.id, type: "memo", title: memoRow.title, body: memoRow.body ?? "", entryDate: memoRow.updatedAt });

  const row = await db.select().from(schema.entry).where(and(eq(schema.entry.id, id), isNull(schema.entry.deletedAt))).get();
  if (!row) return c.json({ error: "not found" }, 404);

  return c.json({ id: row.id, type: row.type, title: row.title ?? "", body: row.body ?? "", entryDate: row.entryDate });
});

app.post("/api/articles", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const { type, title, body, entryDate } = await c.req.json<{ type: string; title?: string; body?: string; entryDate?: number }>();

  if (type === "memo") {
    const key = title?.trim() || `memo-${Date.now()}`;
    const id = generateId("mem");
    await db.insert(schema.memo).values({ id, key, title: title ?? key, body: body ?? "", updatedAt: now() });
    return c.json({ id });
  }

  const id = generateId("ent");
  await db.insert(schema.entry).values({ id, type, title: title ?? "", body: body ?? "", entryDate: entryDate ?? null, createdAt: now(), updatedAt: now() });
  return c.json({ id });
});

app.put("/api/articles/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = c.req.param("id");
  const { title, body, entryDate } = await c.req.json<{ title?: string; body?: string; entryDate?: number }>();

  const memoRow = await db.select({ id: schema.memo.id }).from(schema.memo).where(eq(schema.memo.id, id)).get();
  if (memoRow) {
    await db.update(schema.memo).set({ title: title ?? undefined, body: body ?? undefined, updatedAt: now() }).where(eq(schema.memo.id, id));
    return c.json({ ok: true });
  }

  await db.update(schema.entry).set({ title: title ?? undefined, body: body ?? undefined, entryDate: entryDate ?? undefined, updatedAt: now() }).where(eq(schema.entry.id, id));
  return c.json({ ok: true });
});

app.delete("/api/articles/:id", async (c) => {
  const db = drizzle(c.env.DB, { schema });
  const id = c.req.param("id");

  const memoRow = await db.select({ id: schema.memo.id }).from(schema.memo).where(eq(schema.memo.id, id)).get();
  if (memoRow) {
    await db.delete(schema.memo).where(eq(schema.memo.id, id));
    return c.json({ ok: true });
  }

  await db.update(schema.entry).set({ deletedAt: now() }).where(eq(schema.entry.id, id));
  return c.json({ ok: true });
});

// ─── Assets (R2) ─────────────────────────────────────────────────────────────

app.post("/api/assets/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file") as File | null;
  const entryId = formData.get("entryId") as string | null;

  if (!file) return c.json({ error: "no file" }, 400);

  const buf = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", buf);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);

  const name = file.name || "upload.jpg";
  let ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : ".jpg";
  if (ext === ".jpeg") ext = ".jpg";

  const filename = `${hash}${ext}`;
  const mimeType = file.type || (ext === ".png" ? "image/png" : "image/jpeg");

  // 上传到 R2
  await c.env.R2.put(filename, buf, { httpMetadata: { contentType: mimeType } });

  // 生成公网 URL（R2 Public Bucket URL，需要在 Cloudflare 控制台开启）
  const url = `/media/${filename}`;

  // 写入 asset 表
  const db = drizzle(c.env.DB, { schema });
  await db.insert(schema.asset).values({
    id: generateId("ast"),
    entryId: entryId || null,
    storageKey: filename,
    url,
    mimeType,
    size: buf.byteLength,
    createdAt: now(),
  });

  return c.json({ url, filename });
});

// R2 媒体文件代理（通过 Worker 提供）
app.get("/media/:filename", async (c) => {
  const filename = c.req.param("filename");
  const object = await c.env.R2.get(filename);
  if (!object) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

export default app;
