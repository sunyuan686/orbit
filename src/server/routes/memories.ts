import { db } from "../../db/index.js";
import { createMemoriesRoutes } from "../../api/memories.js";
import { getDevNotifyRuntime } from "../notify-runtime.js";

export const memories = createMemoriesRoutes(() => db, {
  getNotifyRuntime: () => getDevNotifyRuntime(),
});
