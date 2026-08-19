import { db } from "../../db/index.js";
import { createArticlesRoutes } from "../../api/articles.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";
import type { NotifyRuntime } from "../../services/notify/notify.js";

import { resolvePublicBaseUrl } from "../../lib/public-base-url.js";

function getNotifyRuntime(): NotifyRuntime {
  return {
    baseUrl: resolvePublicBaseUrl("http://localhost:5173"),
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    aiEnv: process.env as NotifyRuntime["aiEnv"],
  };
}

const articles = createArticlesRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getNotifyRuntime: () => getNotifyRuntime(),
});

export { articles };
