import { db } from "../../db/index.js";
import { createMemoriesRoutes } from "../../api/memories.js";
import type { NotifyRuntime } from "../../services/notify/notify.js";
import { resolvePublicBaseUrl } from "../../lib/public-base-url.js";

function getNotifyRuntime(): NotifyRuntime {
  return {
    baseUrl: resolvePublicBaseUrl("http://localhost:5173"),
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    aiEnv: process.env as NotifyRuntime["aiEnv"],
  };
}

export const memories = createMemoriesRoutes(() => db, {
  getNotifyRuntime: () => getNotifyRuntime(),
});
