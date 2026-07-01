import { db } from "../../db/index.js";
import { createCommentsRoutes } from "../../api/comments.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";
import type { NotifyRuntime } from "../../services/notify.js";

function getNotifyRuntime(): NotifyRuntime {
  return {
    baseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
    secret: process.env.BETTER_AUTH_SECRET ?? "",
    aiEnv: process.env as NotifyRuntime["aiEnv"],
  };
}

const comments = createCommentsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getNotifyRuntime: () => getNotifyRuntime(),
});

export { comments };
