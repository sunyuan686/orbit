import { db } from "../../db/index.js";
import { createArticlesRoutes } from "../../api/articles.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";
import { getDevNotifyRuntime } from "../notify-runtime.js";

const articles = createArticlesRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getNotifyRuntime: () => getDevNotifyRuntime(),
});

export { articles };
