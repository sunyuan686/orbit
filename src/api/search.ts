import { Hono } from "hono";
import type { Context } from "hono";
import { createLogger } from "../lib/logger.js";
import { createSearchService, getSearchIndexStatus } from "../services/content/search.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("search");

export function createSearchRoutes(getDb: DbProvider) {
  const search = new Hono();

  search.get("/status", async (c) => {
    const db = await getDb(c);
    try {
      const status = await getSearchIndexStatus(db);
      return c.json(status);
    } catch (err) {
      log.error("status failed", err);
      return c.json({ error: "无法读取索引状态" }, 500);
    }
  });

  search.get("/", async (c) => {
    const query = c.req.query("q");
    if (!query || query.trim().length === 0) {
      return c.json({ error: "缺少搜索关键词 q" }, 400);
    }
    if (query.length > 200) {
      return c.json({ error: "搜索词过长" }, 400);
    }

    const limitParam = c.req.query("limit");
    const limit = limitParam ? Math.min(parseInt(limitParam, 10) || 20, 50) : 20;
    const offsetParam = c.req.query("offset");
    const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10) || 0) : 0;
    const type = c.req.query("type") ?? undefined;

    const db = await getDb(c);
    const searchService = createSearchService(db);

    try {
      const results = await searchService.search(query, { limit, offset, type });
      return c.json({ query, results, count: results.length });
    } catch (err) {
      log.error("query failed", err, { query });
      return c.json({ error: "搜索失败，请稍后重试" }, 500);
    }
  });

  return search;
}
