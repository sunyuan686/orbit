import { Hono } from "hono";
import type { Context } from "hono";
import { queryAuditLogs } from "../services/space/audit.js";

type DbProvider = (c: Context) => any | Promise<any>;

export function createAuditRoutes(getDb: DbProvider) {
  const audit = new Hono();

  audit.get("/", async (c) => {
    const db = await getDb(c);

    const limitRaw = c.req.query("limit");
    const offsetRaw = c.req.query("offset");
    const sinceRaw = c.req.query("since");

    const limit = limitRaw ? Number(limitRaw) : undefined;
    const offset = offsetRaw ? Number(offsetRaw) : undefined;
    const since = sinceRaw ? Number(sinceRaw) : undefined;

    if (limitRaw && Number.isNaN(limit)) {
      return c.json({ error: "limit 参数无效" }, 400);
    }
    if (offsetRaw && Number.isNaN(offset)) {
      return c.json({ error: "offset 参数无效" }, 400);
    }
    if (sinceRaw && Number.isNaN(since)) {
      return c.json({ error: "since 参数无效" }, 400);
    }

    const result = await queryAuditLogs(db, {
      limit,
      offset,
      action: c.req.query("action") || undefined,
      resourceType: c.req.query("resourceType") || undefined,
      resourceId: c.req.query("resourceId") || undefined,
      since,
    });

    return c.json({
      items: result.items,
      total: result.total,
      limit: limit ?? 50,
      offset: offset ?? 0,
    });
  });

  return audit;
}
