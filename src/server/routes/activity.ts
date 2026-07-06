import { db } from "../../db/index.js";
import { createActivityRoutes } from "../../api/activity.js";

export const activity = createActivityRoutes(() => db);
