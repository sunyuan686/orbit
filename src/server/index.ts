import { serve } from "@hono/node-server";
import { Hono } from "hono";
import type { Context, Next } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "path";
import { articles } from "./routes/articles.js";
import { assets } from "./routes/assets.js";
import { auth } from "./auth.js";
import { db } from "../db/index.js";

// 启动时自动执行迁移，保证 DB schema 最新
migrate(db, { migrationsFolder: join(process.cwd(), "src/db/migrations") });

const app = new Hono();

// CORS（开发阶段前端 Vite dev server 跨域）
app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://localhost:3001"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
  })
);

// better-auth 路由（/api/auth/*）
app.on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw));

async function requireAuth(c: Context, next: Next) {
  const session = await auth.api.getSession({ headers: c.req.raw.headers });
  if (!session) return c.json({ error: "Unauthorized" }, 401);
  return next();
}

// 所有内容 API 与媒体资源均需登录
app.use("/api/articles/*", requireAuth);
app.use("/api/articles", requireAuth);
app.use("/api/assets/*", requireAuth);
app.use("/assets/*", requireAuth);

// API 路由
app.route("/api/articles", articles);
app.route("/api/assets", assets);

// 静态文件：图片资源（需登录，见上方 /assets/* 中间件）
app.use(
  "/assets/*",
  serveStatic({
    root: "./data",
  })
);

const port = 3001;
console.log(`Orbit Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
