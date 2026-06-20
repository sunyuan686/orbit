import { db } from "../../db/index.js";
import { createSearchRoutes } from "../../api/search.js";

export const search = createSearchRoutes(() => db);
