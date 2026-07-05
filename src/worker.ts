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
import { listAllR2Objects } from "./services/gallery.js";
import { getSessionAuthor } from "./api/session-author.js";
import { requestContext } from "./lib/request-context.js";
import type { NotifyRuntime } from "./services/notify.js";

export interface Env {
  DB: D1Database;
  R2: R2Bucket;
  AI: Ai;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
  CF_ACCOUNT_ID?: string;
  CF_API_TOKEN?: string;
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
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    credentials: true,
    exposeHeaders: ["X-Conversation-Id"],
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
app.use("/api/account/*", requireAuth);
app.use("/api/account", requireAuth);
app.use("/api/settings/*", requireAuth);
app.use("/api/settings", requireAuth);
app.use("/api/audit/*", requireAuth);
app.use("/api/audit", requireAuth);
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
    },
  };
}

function runInBackground(c: Context<HonoEnv>, task: Promise<unknown>): void {
  c.executionCtx.waitUntil(task);
}

app.use("/api/notifications/*", requireAuth);
app.use("/api/notifications", requireAuth);
app.use("/api/gallery/*", requireAuth);
app.use("/api/gallery", requireAuth);
app.use("/api/integrations/*", async (c, next) => {
  const path = new URL(c.req.url).pathname;
  if (
    path === "/api/integrations/feishu/events" ||
    path === "/api/integrations/feishu/callbacks"
  ) {
    return next();
  }
  return requireAuth(c, next);
});

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
    listObjects: async (c) => listAllR2Objects(c.env.R2),
    deleteObject: async (c, storageKey) => {
      await c.env.R2.delete(storageKey);
      return true;
    },
  })
);

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

export default app;
