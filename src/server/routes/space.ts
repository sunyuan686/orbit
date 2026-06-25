import { db } from "../../db/index.js";
import { createSpaceRoutes } from "../../api/space.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const space = createSpaceRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { space };
