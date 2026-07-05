import { db } from "../../db/index.js";
import { createApiTokenRoutes } from "../../api/api-tokens.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const apiTokens = createApiTokenRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { apiTokens };
