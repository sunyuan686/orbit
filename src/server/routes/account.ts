import { db } from "../../db/index.js";
import { createAccountRoutes } from "../../api/account.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const account = createAccountRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { account };
