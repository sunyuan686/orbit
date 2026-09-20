import { db } from "../../db/index.js";
import { createTagsRoutes } from "../../api/tags.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const tags = createTagsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { tags };
