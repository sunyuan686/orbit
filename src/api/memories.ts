import { Hono } from "hono";
import type { Context } from "hono";
import { createLogger } from "../lib/logger.js";
import type { NotifyRuntime } from "../services/notify/notify.js";
import {
  MEMORY_ENTRY_TYPES,
  celebrateMilestones,
  getMemorySummary,
  layoutTimeline,
  listMemoryNodes,
  notifyMilestonesViaFeishu,
  syncMilestoneUnlocks,
} from "../services/companion/love-memories.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("memories");

function parseIntParam(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function createMemoriesRoutes(
  getDb: DbProvider,
  options: {
    getNotifyRuntime?: (c: Context) => NotifyRuntime | undefined;
    waitUntil?: (c: Context, task: Promise<unknown>) => void;
  } = {}
) {
  const memories = new Hono();
  const { getNotifyRuntime, waitUntil } = options;

  memories.get("/summary", async (c) => {
    const db = await getDb(c);
    try {
      const summary = await getMemorySummary(db);
      return c.json(summary);
    } catch (err) {
      log.error("summary failed", err);
      return c.json({ error: "读取记忆摘要失败" }, 500);
    }
  });

  memories.get("/nodes", async (c) => {
    const type = c.req.query("type");
    if (type && !MEMORY_ENTRY_TYPES.includes(type as any)) {
      return c.json({ error: "无效 type" }, 400);
    }

    const limit = parseIntParam(c.req.query("limit") ?? undefined);
    const offset = parseIntParam(c.req.query("offset") ?? undefined);
    const from = parseIntParam(c.req.query("from") ?? undefined);
    const to = parseIntParam(c.req.query("to") ?? undefined);
    const year = parseIntParam(c.req.query("year") ?? undefined);
    const hasCover = c.req.query("hasCover") === "1";

    if (c.req.query("limit") && limit == null) {
      return c.json({ error: "limit 须为数字" }, 400);
    }
    if (c.req.query("offset") && offset == null) {
      return c.json({ error: "offset 须为数字" }, 400);
    }
    if (c.req.query("from") && from == null) {
      return c.json({ error: "from 须为数字" }, 400);
    }
    if (c.req.query("to") && to == null) {
      return c.json({ error: "to 须为数字" }, 400);
    }
    if (c.req.query("year") && year == null) {
      return c.json({ error: "year 须为数字" }, 400);
    }

    const db = await getDb(c);
    try {
      const result = await listMemoryNodes(db, {
        limit: limit ?? undefined,
        offset: offset ?? undefined,
        type: type ?? undefined,
        from: from ?? undefined,
        to: to ?? undefined,
        year: year ?? undefined,
        hasCover: hasCover || undefined,
      });
      return c.json(result);
    } catch (err) {
      log.error("nodes failed", err);
      const detail = err instanceof Error ? err.message : String(err);
      return c.json({ error: "读取记忆节点失败", detail }, 500);
    }
  });

  memories.get("/milestones", async (c) => {
    const db = await getDb(c);
    try {
      const { milestones, newlyUnlocked } = await syncMilestoneUnlocks(db);
      const runtime = getNotifyRuntime?.(c);
      if (runtime && newlyUnlocked.length > 0) {
        const task = notifyMilestonesViaFeishu(
          db,
          runtime.secret,
          runtime.baseUrl,
          newlyUnlocked
        ).catch((err) => {
          log.error("feishu milestone notify failed", err);
        });
        if (waitUntil) waitUntil(c, task);
        else void task;
      }
      return c.json({
        milestones,
        newlyUnlocked: newlyUnlocked.map((item) => item.key),
      });
    } catch (err) {
      log.error("milestones failed", err);
      return c.json({ error: "读取里程碑失败" }, 500);
    }
  });

  memories.post("/milestones/celebrate", async (c) => {
    const db = await getDb(c);
    let body: { keys?: unknown };
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: "无效 JSON" }, 400);
    }
    const keys = Array.isArray(body.keys)
      ? body.keys.filter((key): key is string => typeof key === "string")
      : [];
    try {
      const milestones = await celebrateMilestones(db, keys);
      return c.json({ milestones });
    } catch (err) {
      log.error("celebrate failed", err);
      return c.json({ error: "标记里程碑失败" }, 500);
    }
  });

  memories.get("/timeline", async (c) => {
    const limit = parseIntParam(c.req.query("limit") ?? undefined) ?? 200;
    const db = await getDb(c);
    try {
      const result = await listMemoryNodes(db, {
        limit,
        offset: 0,
      });
      const laidOut = layoutTimeline(result.nodes);
      return c.json({
        total: result.total,
        width: laidOut.width,
        height: laidOut.height,
        nodes: laidOut.nodes,
      });
    } catch (err) {
      log.error("timeline failed", err);
      return c.json({ error: "读取星图失败" }, 500);
    }
  });

  return memories;
}
