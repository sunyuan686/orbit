import { db } from "../../db/index.js";
import { createAlbumsRoutes } from "../../api/albums.js";
import { getSessionAuthor } from "../../api/session-author.js";
import { auth } from "../auth.js";

const albums = createAlbumsRoutes(() => db, {
  getSessionAuthor: (c) => getSessionAuthor(c, auth, () => db),
});

export { albums };
