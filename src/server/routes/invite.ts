import { db } from "../../db/index.js";
import { createInviteRoutes } from "../../api/invite.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";
import { AUTH_BASE_URL } from "../../config/auth.js";

const invite = createInviteRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
  getBaseUrl: () => AUTH_BASE_URL,
});

export { invite };
