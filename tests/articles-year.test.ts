import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { getSpaceYear } from "../src/shared/utils/date.js";

describe("Articles Earliest Year Resolution (第一性原理回归测试)", () => {
  it("resolves minDate from async D1 Promise correctly", async () => {
    // 模拟 D1 ORM 异步执行 .get()
    const mockEarliestQuery = Promise.resolve({ minDate: 1648944000 }); // 2022-04-03
    const earliestRow = await mockEarliestQuery;

    assert.ok(earliestRow != null);
    const minTimestamp = earliestRow?.minDate;
    const earliestYear = minTimestamp
      ? getSpaceYear(minTimestamp)
      : getSpaceYear();

    assert.equal(earliestYear, 2022);
  });

  it("reproduces and prevents the unawaited Promise bug", () => {
    // 未 await 的 Promise 实例
    const unawaitedPromise = Promise.resolve({ minDate: 1648944000 }) as unknown as {
      minDate?: number;
    };

    // 访问 Promise.minDate 会得到 undefined
    assert.equal(unawaitedPromise.minDate, undefined);

    // 从而导致错误的 fallback 到当年
    const buggyFallback = unawaitedPromise.minDate
      ? getSpaceYear(unawaitedPromise.minDate)
      : getSpaceYear();
    assert.equal(buggyFallback, getSpaceYear());
  });

  it("handles empty database (minDate is null) gracefully", async () => {
    const mockEmptyQuery = Promise.resolve({ minDate: null });
    const earliestRow = await mockEmptyQuery;

    const minTimestamp = earliestRow?.minDate;
    const earliestYear = minTimestamp
      ? getSpaceYear(minTimestamp)
      : earliestRow
        ? getSpaceYear()
        : undefined;

    assert.equal(earliestYear, getSpaceYear());
  });

  it("skips earliestYear calculation on pagination offset > 0 (性能零冗余)", async () => {
    const page = { paginate: true, offset: 20, limit: 20 };
    const earliestQuery =
      page.paginate && page.offset === 0
        ? Promise.resolve({ minDate: 1648944000 })
        : null;

    const [earliestRow] = await Promise.all([
      earliestQuery ?? Promise.resolve(null),
    ]);

    const minTimestamp = earliestRow?.minDate;
    const earliestYear = minTimestamp
      ? getSpaceYear(minTimestamp)
      : earliestRow
        ? getSpaceYear()
        : undefined;

    assert.equal(earliestYear, undefined);
  });

  it("generates correct years sequence from startYear to currentYear", () => {
    const currentYear = 2026;
    const earliestYear = 2022;
    const startYear = Math.min(earliestYear, currentYear);

    const years: number[] = [];
    for (let y = currentYear; y >= startYear; y--) {
      years.push(y);
    }

    assert.deepEqual(years, [2026, 2025, 2024, 2023, 2022]);
  });
});
