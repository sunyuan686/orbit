import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { Hono } from "hono";
import { createMemoriesRoutes } from "../src/api/memories.js";
import { createTestDb } from "./helpers/test-db.js";

const { db, sqlite } = createTestDb();
after(() => sqlite.close());

describe("Memory Sky API (第一性原理按日聚合回归测试)", () => {
  const app = new Hono();
  app.route("/api/memories", createMemoriesRoutes(() => db));

  it("GET /api/memories/sky - 返回全量按日聚合星空数据，永不截断", async () => {
    const res = await app.request("/api/memories/sky");
    assert.equal(res.status, 200);

    const data = (await res.json()) as {
      days: Array<{
        date: string;
        count: number;
        dominantType: string;
        weight: number;
        entries: Array<{
          id: string;
          contentType: string;
          title: string | null;
          snippet: string;
          occurredAt: number;
          link: string;
        }>;
      }>;
      totalDays: number;
      totalEntries: number;
    };

    assert.ok(data && typeof data === "object", "返回对象数据");
    assert.ok(Array.isArray(data.days), "days 必须为数组");
    assert.equal(data.totalDays, data.days.length, "totalDays 严格等于 days 长度");
    assert.ok(typeof data.totalEntries === "number", "totalEntries 必须为数字");

    // 验证条目计数一致性
    const calculatedEntries = data.days.reduce((acc, d) => acc + d.count, 0);
    assert.equal(calculatedEntries, data.totalEntries, "所有日子 count 之和严格等于 totalEntries");

    // 验证按日期升序排列
    for (let i = 1; i < data.days.length; i++) {
      assert.ok(
        data.days[i - 1].date <= data.days[i].date,
        `日期必须保持时间正序: ${data.days[i - 1].date} <= ${data.days[i].date}`
      );
    }

    // 验证每一天的结构与内部时间排序
    for (const day of data.days) {
      assert.match(day.date, /^\d{4}-\d{2}-\d{2}$/, "日期必须为 YYYY-MM-DD 格式");
      assert.ok(day.count >= 1, "每个日子至少有 1 个瞬间");
      assert.equal(day.entries.length, day.count, "entries 数量与 count 一致");
      assert.ok(["moment", "letter"].includes(day.dominantType), "主导类型必须为合法类型");
      assert.ok([1, 2, 3].includes(day.weight), "权重必须在 [1, 2, 3] 区间");

      // 当天内部条目应按时间倒序排列（最新的在最前）
      for (let j = 1; j < day.entries.length; j++) {
        assert.ok(
          day.entries[j - 1].occurredAt >= day.entries[j].occurredAt,
          "当天内部条目应按时间倒序"
        );
      }
    }
  });
});
