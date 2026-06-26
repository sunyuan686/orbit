import { db } from "../../db/index.js";
import { createAuditRoutes } from "../../api/audit.js";

const audit = createAuditRoutes(() => db);

export { audit };
