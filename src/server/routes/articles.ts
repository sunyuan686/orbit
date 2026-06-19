import { db } from "../../db/index.js";
import { createArticlesRoutes } from "../../api/articles.js";

const articles = createArticlesRoutes(() => db);

export { articles };
