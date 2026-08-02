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
import { createCommentsRoutes } from "./api/comments.js";
import { createSpaceRoutes } from "./api/space.js";
import { createSettingsRoutes } from "./api/settings.js";
import { createAuditRoutes } from "./api/audit.js";
import { createAiRoutes } from "./api/ai.js";
import { createIntegrationsRoutes } from "./api/integrations.js";
import { createNotificationsRoutes } from "./api/notifications.js";
import { createInviteRoutes } from "./api/invite.js";
import { createAccountRoutes } from "./api/account.js";
import { createGalleryRoutes } from "./api/gallery.js";
import { createApiTokenRoutes } from "./api/api-tokens.js";
import { createActivityRoutes } from "./api/activity.js";
import { createMemoriesRoutes } from "./api/memories.js";
import { getSessionAuthor } from "./api/session-author.js";
import { requestContext } from "./lib/request-context.js";
import { createRequireAuth } from "./lib/request-auth.js";
import { verifyTurnstileToken } from "./lib/turnstile.js";
import type { NotifyRuntime } from "./services/notify.js";
import { CompanionScheduler } from "./services/companion-scheduler.js";
import { scanTestCandidate } from "./services/companion-engine.js";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  TURNSTILE_SECRET_KEY?: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
  TAVILY_API_KEY?: string;
  BRAVE_SEARCH_API_KEY?: string;
  LANGFUSE_PUBLIC_KEY?: string;
  LANGFUSE_SECRET_KEY?: string;
  LANGFUSE_BASE_URL?: string;
  LANGFUSE_ENV?: string;
  LANGFUSE_PROJECT_ID?: string;
  COMPANION_SCHEDULER: DurableObjectNamespace<CompanionScheduler>;
}

type HonoEnv = { Bindings: Env };

const app = new Hono<HonoEnv>();

app.use("*", requestContext);

function getDb(c: Context<HonoEnv>) {
  return drizzle(c.env.DB, { schema });
}

app.use(
  "*",
  cors({
    origin: (origin) => origin,
    allowHeaders: ["Content-Type", "Authorization", "x-turnstile-token"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["X-Conversation-Id"],
  })
);

// ─── Auth ────────────────────────────────────────────────────────────────────

const workerTurnstileMiddleware = async (c: any, next: () => Promise<void>) => {
  const secret = c.env.TURNSTILE_SECRET_KEY;
  if (secret) {
    const token = c.req.header("x-turnstile-token") || "";
    const clientIp = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for");
    const result = await verifyTurnstileToken(token, clientIp);
    if (!result.success) {
      return c.json(
        {
          status: 400,
          message: "真人验证失败，请在页面完成真人验证后再尝试",
          error: { message: "真人验证失败，请在页面完成真人验证后再尝试" },
        },
        400
      );
    }
  }
  await next();
};

app.use("/api/auth/sign-in/*", workerTurnstileMiddleware);
app.use("/api/auth/sign-up/*", workerTurnstileMiddleware);

app.on(["GET", "POST"], "/api/auth/*", async (c) => {
  const auth = createAuth(getDb(c), {
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: c.env.BETTER_AUTH_URL,
  });
  return auth.handler(c.req.raw);
});

// API 防缓存响应头
app.use("/api/*", async (c, next) => {
  await next();
  c.header("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
  c.header("Pragma", "no-cache");
  c.header("Expires", "0");
});

// ─── Auth middleware ──────────────────────────────────────────────────────────

function workerAuth(c: Context<HonoEnv>) {
  return createAuth(getDb(c), {
    secret: c.env.BETTER_AUTH_SECRET,
    baseURL: c.env.BETTER_AUTH_URL,
  });
}

const requireAuth = createRequireAuth({
  getAuth: (c) => workerAuth(c as Context<HonoEnv>),
  getDb: (c) => getDb(c as Context<HonoEnv>),
  allowApiToken: true,
});

const requireSession = createRequireAuth({
  getAuth: (c) => workerAuth(c as Context<HonoEnv>),
  getDb: (c) => getDb(c as Context<HonoEnv>),
  allowApiToken: false,
});

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

function getNotifyRuntime(c: Context<HonoEnv>): NotifyRuntime {
  return {
    baseUrl: c.env.BETTER_AUTH_URL,
    secret: c.env.BETTER_AUTH_SECRET,
    aiEnv: {
      AI: c.env.AI,
      BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
      CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID,
      CF_API_TOKEN: c.env.CF_API_TOKEN,
      TAVILY_API_KEY: c.env.TAVILY_API_KEY,
      BRAVE_SEARCH_API_KEY: c.env.BRAVE_SEARCH_API_KEY,
      LANGFUSE_PUBLIC_KEY: c.env.LANGFUSE_PUBLIC_KEY,
      LANGFUSE_SECRET_KEY: c.env.LANGFUSE_SECRET_KEY,
      LANGFUSE_BASE_URL: c.env.LANGFUSE_BASE_URL,
      LANGFUSE_ENV: c.env.LANGFUSE_ENV,
      LANGFUSE_PROJECT_ID: c.env.LANGFUSE_PROJECT_ID,
    },
  };
}

function runInBackground(c: Context<HonoEnv>, task: Promise<unknown>): void {
  c.executionCtx.waitUntil(task);
}

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

app.route("/api/api-tokens", createApiTokenRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, workerAuth(c as Context<HonoEnv>), getDb),
}));

// ─── Shared API routes ───────────────────────────────────────────────────────

app.route("/api/audit", createAuditRoutes(getDb));
app.route("/api/search", createSearchRoutes(getDb));
app.route("/api/comments", createCommentsRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
  getNotifyRuntime: (c) => getNotifyRuntime(c),
  waitUntil: (c, task) => runInBackground(c, task),
}));
app.route("/api/articles", createArticlesRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
  getNotifyRuntime: (c) => getNotifyRuntime(c),
  waitUntil: (c, task) => runInBackground(c, task),
}));
app.route("/api/space", createSpaceRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
}));
app.route("/api/invite", createInviteRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
  getBaseUrl: (c) => c.env.BETTER_AUTH_URL,
}));
app.route("/api/account", createAccountRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
}));
app.route("/api/settings", createSettingsRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
  getSecret: (c) => c.env.BETTER_AUTH_SECRET,
}));
app.route("/api/ai", createAiRoutes(getDb, {
  getSessionAuthor: (c) =>
    getSessionAuthor(c, createAuth(getDb(c), {
      secret: c.env.BETTER_AUTH_SECRET,
      baseURL: c.env.BETTER_AUTH_URL,
    }), getDb),
  getEnv: (c) => ({
    AI: c.env.AI,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID,
    CF_API_TOKEN: c.env.CF_API_TOKEN,
    TAVILY_API_KEY: c.env.TAVILY_API_KEY,
    BRAVE_SEARCH_API_KEY: c.env.BRAVE_SEARCH_API_KEY,
    LANGFUSE_PUBLIC_KEY: c.env.LANGFUSE_PUBLIC_KEY,
    LANGFUSE_SECRET_KEY: c.env.LANGFUSE_SECRET_KEY,
    LANGFUSE_BASE_URL: c.env.LANGFUSE_BASE_URL,
    LANGFUSE_ENV: c.env.LANGFUSE_ENV,
    LANGFUSE_PROJECT_ID: c.env.LANGFUSE_PROJECT_ID,
  }),
}));
app.route(
  "/api/integrations",
  createIntegrationsRoutes(getDb, {
    getSessionAuthor: (c) =>
      getSessionAuthor(c, createAuth(getDb(c), {
        secret: c.env.BETTER_AUTH_SECRET,
        baseURL: c.env.BETTER_AUTH_URL,
      }), getDb),
    getSecret: (c) => c.env.BETTER_AUTH_SECRET,
    getWebhookBaseUrl: (c) => c.env.BETTER_AUTH_URL,
    getNotifyRuntime: (c) => getNotifyRuntime(c),
    getAiEnv: (c) => getNotifyRuntime(c).aiEnv,
    saveAsset: async ({ filename, mimeType, body }, c) => {
      await c.env.R2.put(filename, body, {
        httpMetadata: { contentType: mimeType },
      });
      return `/assets/${filename}`;
    },
    waitUntil: (c, task) => runInBackground(c, task),
  })
);
app.route(
  "/api/notifications",
  createNotificationsRoutes(getDb, {
    getSessionAuthor: (c) =>
      getSessionAuthor(c, createAuth(getDb(c), {
        secret: c.env.BETTER_AUTH_SECRET,
        baseURL: c.env.BETTER_AUTH_URL,
      }), getDb),
  })
);
app.route(
  "/api/assets",
  createAssetsRoutes(getDb, {
    async save({ filename, mimeType, body }, c) {
      await (c as Context<HonoEnv>).env.R2.put(filename, body, {
        httpMetadata: { contentType: mimeType },
      });
      return `/assets/${filename}`;
    },
  })
);
app.route(
  "/api/gallery",
  createGalleryRoutes(getDb, {
    deleteObject: async (c, storageKey) => {
      const existing = await c.env.R2.head(storageKey);
      if (!existing) return false;
      await c.env.R2.delete(storageKey);
      return true;
    },
  })
);
app.route("/api/stats/activity", createActivityRoutes(getDb));
app.route("/api/memories", createMemoriesRoutes(getDb, {
  getNotifyRuntime: (c) => getNotifyRuntime(c),
  waitUntil: (c, task) => runInBackground(c, task),
}));

// R2 媒体文件代理（需登录，路径与本地 dev 一致）
app.get("/assets/:filename", requireAuth, async (c) => {
  const filename = c.req.param("filename");
  const object = await c.env.R2.get(filename);
  if (!object) return c.json({ error: "not found" }, 404);

  const headers = new Headers();
  headers.set("Content-Type", object.httpMetadata?.contentType ?? "application/octet-stream");
  headers.set("Cache-Control", "public, max-age=31536000, immutable");

  return new Response(object.body, { headers });
});

// ─── Companion Scheduler API ─────────────────────────────────────────────────

function getCompanionScheduler(c: Context<HonoEnv>) {
  return c.env.COMPANION_SCHEDULER.getByName("companion");
}

// 首次部署后调用一次，启动 alarm 循环
app.post("/api/companion/bootstrap", requireSession, async (c) => {
  const result = await getCompanionScheduler(c).bootstrap();
  return c.json(result);
});

// 用户改完配置（安静时段等）后调用，立即 reschedule
app.post("/api/companion/reschedule", requireSession, async (c) => {
  const result = await getCompanionScheduler(c).reschedule();
  return c.json(result);
});

// 查询当前 alarm 状态，供设置页展示"下次推送时间"
app.get("/api/companion/status", requireSession, async (c) => {
  const result = await getCompanionScheduler(c).status();
  return c.json(result);
});

// 手动触发一条测试陪伴推送（发送至站内通知与飞书）
app.post("/api/companion/test", requireSession, async (c) => {
  const sessionAuthor = await getSessionAuthor(c, workerAuth(c as Context<HonoEnv>), getDb);
  if (!sessionAuthor) return c.json({ error: "Unauthorized" }, 401);

  const db = getDb(c);
  const nowTs = Math.floor(Date.now() / 1000);
  const aiEnv = {
    AI: c.env.AI,
    BETTER_AUTH_SECRET: c.env.BETTER_AUTH_SECRET,
    CF_ACCOUNT_ID: c.env.CF_ACCOUNT_ID,
    CF_API_TOKEN: c.env.CF_API_TOKEN,
  };

  const candidate = await scanTestCandidate(db, sessionAuthor.userId, nowTs);
  const { deliverCompanionCard } = await import("./services/feishu-companion-card.js");
  await deliverCompanionCard(
    candidate,
    {
      db,
      secret: c.env.BETTER_AUTH_SECRET,
      baseUrl: c.env.BETTER_AUTH_URL,
      aiEnv,
    },
    nowTs
  );

  return c.json({ success: true, candidate });
});

export { CompanionScheduler };

export default app;
