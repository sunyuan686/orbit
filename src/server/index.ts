import "dotenv/config";
import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serveStatic } from "@hono/node-server/serve-static";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { join } from "path";
import { articles } from "./routes/articles.js";
import { assets } from "./routes/assets.js";
import { search } from "./routes/search.js";
import { comments } from "./routes/comments.js";
import { space } from "./routes/space.js";
import { settings } from "./routes/settings.js";
import { audit } from "./routes/audit.js";
import { ai } from "./routes/ai.js";
import { integrations } from "./routes/integrations.js";
import { notifications } from "./routes/notifications.js";
import { gallery } from "./routes/gallery.js";
import { invite } from "./routes/invite.js";
import { account } from "./routes/account.js";
import { auth } from "./auth.js";
import { DEV_FRONTEND_ORIGINS } from "../config/auth.js";
import { db } from "../db/index.js";
import { createLogger } from "../lib/logger.js";
import { requestContext } from "../lib/request-context.js";
import { createRequireAuth } from "../lib/request-auth.js";
import { apiTokens } from "./routes/api-tokens.js";
import { activity } from "./routes/activity.js";
import { memories } from "./routes/memories.js";

const bootLog = createLogger("server");

// 启动时自动执行迁移，保证 DB schema 最新
migrate(db, { migrationsFolder: join(process.cwd(), "src/db/migrations") });

const app = new Hono();

app.use("*", requestContext);

// CORS（开发阶段前端 Vite dev server 跨域）
app.use(
  "*",
  cors({
    origin: [...DEV_FRONTEND_ORIGINS, "http://localhost:3001"],
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["X-Conversation-Id"],
  })
);

// better-auth 路由（/api/auth/*）
app.on(["GET", "POST"], "/api/auth/**", (c) => auth.handler(c.req.raw));

const requireAuth = createRequireAuth({
  getAuth: () => auth,
  getDb: () => db,
  allowApiToken: true,
});

const requireSession = createRequireAuth({
  getAuth: () => auth,
  getDb: () => db,
  allowApiToken: false,
});

// 所有内容 API 与媒体资源均需登录
app.use("/api/articles/*", requireAuth);
app.use("/api/articles", requireAuth);
app.use("/api/search/*", requireAuth);
app.use("/api/search", requireAuth);
app.use("/api/comments/*", requireAuth);
app.use("/api/comments", requireAuth);
app.use("/api/assets/*", requireAuth);
app.use("/api/space/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/api/space/status") return next();
  return requireAuth(c, next);
});
app.use("/api/space", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (path === "/api/space/status") return next();
  return requireAuth(c, next);
});
app.use("/api/account/*", requireSession);
app.use("/api/account", requireSession);
app.use("/api/settings/*", requireSession);
app.use("/api/settings", requireSession);
app.use("/api/audit/*", requireSession);
app.use("/api/audit", requireSession);
app.use("/api/api-tokens/*", requireSession);
app.use("/api/api-tokens", requireSession);
app.use("/api/ai/*", requireAuth);
app.use("/api/ai", requireAuth);
app.use("/api/notifications/*", requireSession);
app.use("/api/notifications", requireSession);
app.use("/api/gallery/*", requireAuth);
app.use("/api/gallery", requireAuth);
app.use("/api/stats/*", requireAuth);
app.use("/api/stats", requireAuth);
app.use("/api/memories/*", requireAuth);
app.use("/api/memories", requireAuth);
app.use("/api/integrations/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (
    path === "/api/integrations/feishu/events" ||
    path === "/api/integrations/feishu/callbacks"
  ) {
    return next();
  }
  return requireSession(c, next);
});
app.use("/assets/*", requireAuth);

// API 路由
app.route("/api/articles", articles);
app.route("/api/search", search);
app.route("/api/comments", comments);
app.route("/api/assets", assets);
app.route("/api/space", space);
app.route("/api/invite", invite);
app.route("/api/account", account);
app.route("/api/settings", settings);
app.route("/api/audit", audit);
app.route("/api/api-tokens", apiTokens);
app.route("/api/ai", ai);
app.route("/api/integrations", integrations);
app.route("/api/notifications", notifications);
app.route("/api/gallery", gallery);
app.route("/api/stats/activity", activity);
app.route("/api/memories", memories);

// 静态文件：图片资源（需登录，见上方 /assets/* 中间件）
app.use(
  "/assets/*",
  serveStatic({
    root: "./data",
  })
);

const port = 3001;
bootLog.info(`Orbit Server running at http://localhost:${port}`);
serve({ fetch: app.fetch, port });
