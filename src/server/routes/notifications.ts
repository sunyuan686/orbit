import { db } from "../../db/index.js";
import { createNotificationsRoutes } from "../../api/notifications.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const notifications = createNotificationsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { notifications };
