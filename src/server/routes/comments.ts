import { db } from "../../db/index.js";
import { createCommentsRoutes } from "../../api/comments.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const comments = createCommentsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { comments };
