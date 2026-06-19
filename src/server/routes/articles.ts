import { db } from "../../db/index.js";
import { createArticlesRoutes } from "../../api/articles.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const articles = createArticlesRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { articles };
