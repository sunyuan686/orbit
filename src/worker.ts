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
import type { Context } from "hono";
import { cors } from "hono/cors";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./db/schema.js";
import { createAuth } from "./auth.js";
import { createArticlesRoutes } from "./api/articles.js";
import { createAssetsRoutes } from "./api/assets.js";
import { createSearchRoutes } from "./api/search.js";
import { getSessionAuthor } from "./api/session-author.js";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

function getDb(c: Context<HonoEnv>) {
  return drizzle(c.env.DB, { schema });
}

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

app.on(["GET", "POST"], "/api/auth/**", async (c) => {
  const auth = createAuth(getDb(c), {
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: c.env.BETTER_AUTH_URL,
  });
  return auth.handler(c.req.raw);
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

async function requireAuth(c: Context<HonoEnv>, next: () => Promise<void>) {
  const auth = createAuth(getDb(c), {
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: c.env.BETTER_AUTH_URL,
  });
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return next();
}

app.use("/api/articles/*", requireAuth);
app.use("/api/articles", requireAuth);
app.use("/api/search/*", requireAuth);
app.use("/api/search", requireAuth);
app.use("/api/assets/*", requireAuth);

// ─── Shared API routes ───────────────────────────────────────────────────────

app.route("/api/search", createSearchRoutes(getDb));
app.route("/api/articles", createArticlesRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
}));
app.route(
  "/api/assets",
  createAssetsRoutes(getDb, {
    async save({ filename, mimeType, body }, c) {
      await (c as Context<HonoEnv>).env.R2.put(filename, body, {
        httpMetadata: { contentType: mimeType },
      });
      return `/media/${filename}`;
    },
  })
);

// R2 媒体文件代理（需登录）
app.get("/media/:filename", requireAuth, async (c) => {
  const filename = c.req.param("filename");
  const object = await c.env.R2.get(filename);
  if (!object) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

export default app;
