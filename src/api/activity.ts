import { Hono } from "hono";
import type { Context } from "hono";
import { createLogger } from "../lib/logger.js";
import {
  getActivityDayEntries,
  getActivityStats,
} from "../services/space/activity.js";

type DbProvider = (c: Context) => any | Promise<any>;

const log = createLogger("activity");

const DATE_KEY_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseDaysParam(raw: string | undefined): number | null {
  if (!raw) return null;
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

export function createActivityRoutes(getDb: DbProvider) {
  const activity = new Hono();

  activity.get("/", async (c) => {
    const date = c.req.query("date");
    if (date) {
      if (!DATE_KEY_RE.test(date)) {
        return c.json({ error: "date 须为 YYYY-MM-DD" }, 400);
      }
      const [year, month, day] = date.split("-").map(Number);
      const probe = new Date(Date.UTC(year, month - 1, day));
      if (
        probe.getUTCFullYear() !== year ||
        probe.getUTCMonth() !== month - 1 ||
        probe.getUTCDate() !== day
      ) {
        return c.json({ error: "无效日期" }, 400);
      }

      const db = await getDb(c);
      try {
        const entries = await getActivityDayEntries(db, date);
        return c.json({ date, entries });
      } catch (err) {
        log.error("day entries failed", err, { date });
        return c.json({ error: "读取当日记录失败" }, 500);
      }
    }

    const daysParam = parseDaysParam(c.req.query("days"));
    if (c.req.query("days") && daysParam == null) {
      return c.json({ error: "days 须为数字" }, 400);
    }

    const db = await getDb(c);
    try {
      const stats = await getActivityStats(db, { days: daysParam ?? undefined });
      return c.json(stats);
    } catch (err) {
      log.error("stats failed", err);
      return c.json({ error: "读取活动统计失败" }, 500);
    }
  });

  return activity;
}
