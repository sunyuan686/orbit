import { db } from "../../db/index.js";
import { createSettingsRoutes } from "../../api/settings.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const settings = createSettingsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { settings };
