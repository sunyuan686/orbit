import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  SPACE_TIME_ZONE,
  SPACE_TZ_OFFSET_SECONDS,
  addDays,
  dateKeyToEndOfDayUnix,
  dateKeyToUnix,
  formatDate,
  formatDateCn,
  formatDateTime,
  formatDateWithWeekday,
  formatDiaryDateParts,
  formatRelativeTime,
  formatTime,
  getSpaceDateParts,
  getSpaceTodayKey,
  getSpaceYear,
  isSameSpaceDay,
  parseDateKey,
  unixToDateKey,
} from "../src/shared/utils/date.js";

describe("Unified Space Timezone Toolkit", () => {
  it("has correct timezone constants", () => {
    assert.equal(SPACE_TIME_ZONE, "Asia/Shanghai");
    assert.equal(SPACE_TZ_OFFSET_SECONDS, 28800);
  });

  describe("Midnight Boundary & UTC Rollover (第一性原理临界测试)", () => {
    // 2026-09-01 23:59:59 CST == 2026-09-01 15:59:59 UTC
    const tsJustBeforeMidnight = Date.UTC(2026, 8, 1, 15, 59, 59) / 1000;
    // 2026-09-02 00:00:00 CST == 2026-09-01 16:00:00 UTC
    const tsExactMidnight = Date.UTC(2026, 8, 1, 16, 0, 0) / 1000;
    // 2026-09-02 00:30:00 CST == 2026-09-01 16:30:00 UTC (用户报告的 0 点后场景)
    const tsEarlyMorning0030 = Date.UTC(2026, 8, 1, 16, 30, 0) / 1000;
    // 2026-09-02 07:59:59 CST == 2026-09-01 23:59:59 UTC
    const tsJustBefore0800 = Date.UTC(2026, 8, 1, 23, 59, 59) / 1000;
    // 2026-09-02 08:00:00 CST == 2026-09-02 00:00:00 UTC
    const tsExact0800 = Date.UTC(2026, 8, 2, 0, 0, 0) / 1000;

    it("identifies 23:59:59 as previous day", () => {
      assert.equal(getSpaceTodayKey(tsJustBeforeMidnight), "2026-09-01");
      assert.equal(formatDateTime(tsJustBeforeMidnight), "2026-09-01 23:59");
    });

    it("identifies 00:00:00 as current day immediately at midnight", () => {
      assert.equal(getSpaceTodayKey(tsExactMidnight), "2026-09-02");
      assert.equal(formatDateTime(tsExactMidnight), "2026-09-02 00:00");
    });

    it("identifies 00:30:00 (user bug scenario) as current day 2026-09-02", () => {
      assert.equal(getSpaceTodayKey(tsEarlyMorning0030), "2026-09-02");
      assert.equal(formatDateTime(tsEarlyMorning0030), "2026-09-02 00:30");
      assert.equal(formatTime(tsEarlyMorning0030), "00:30");
    });

    it("keeps current day 2026-09-02 during 00:00~08:00 UTC window", () => {
      assert.equal(getSpaceTodayKey(tsJustBefore0800), "2026-09-02");
      assert.equal(formatDateTime(tsJustBefore0800), "2026-09-02 07:59");

      assert.equal(getSpaceTodayKey(tsExact0800), "2026-09-02");
      assert.equal(formatDateTime(tsExact0800), "2026-09-02 08:00");
    });
  });

  describe("Day-Key conversions and reversibility", () => {
    it("converts between dateKey and Unix timestamp reversibly", () => {
      const dateKey = "2026-09-02";
      const startUnix = dateKeyToUnix(dateKey);
      assert.equal(unixToDateKey(startUnix), dateKey);

      const parts = getSpaceDateParts(startUnix);
      assert.equal(parts.hours, 0);
      assert.equal(parts.minutes, 0);
      assert.equal(parts.seconds, 0);

      const endUnix = dateKeyToEndOfDayUnix(dateKey);
      assert.equal(unixToDateKey(endUnix), dateKey);
      assert.equal(endUnix - startUnix, 86399);

      const endParts = getSpaceDateParts(endUnix);
      assert.equal(endParts.hours, 23);
      assert.equal(endParts.minutes, 59);
      assert.equal(endParts.seconds, 59);
    });

    it("handles addDays across months and leap years", () => {
      assert.equal(addDays("2026-09-02", 1), "2026-09-03");
      assert.equal(addDays("2026-09-01", -1), "2026-08-31");
      assert.equal(addDays("2026-01-01", -1), "2025-12-31");
      assert.equal(addDays("2024-02-28", 1), "2024-02-29");
      assert.equal(addDays("2024-02-29", 1), "2024-03-01");
    });

    it("parses and validates dateKey", () => {
      assert.equal(parseDateKey("2026-09-02"), "2026-09-02");
      assert.equal(parseDateKey(" 2026-09-02 "), "2026-09-02");
      assert.equal(parseDateKey("2026-02-29"), null); // 2026 is not leap year
      assert.equal(parseDateKey("invalid"), null);
      assert.equal(parseDateKey(null), null);
      assert.equal(parseDateKey(undefined), null);
    });
  });

  describe("Formatting Utilities", () => {
    // 2026-09-02 14:05:09 CST
    const testTs = Date.UTC(2026, 8, 2, 6, 5, 9) / 1000;

    it("formats ISO date", () => {
      assert.equal(formatDate(testTs), "2026-09-02");
    });

    it("formats Chinese date", () => {
      assert.equal(formatDateCn(testTs), "2026 年 9 月 2 日");
    });

    it("formats Chinese date with weekday aligned to space timezone", () => {
      assert.equal(formatDateWithWeekday(testTs), "2026 年 9 月 2 日 · 星期三");
    });

    it("formats datetime", () => {
      assert.equal(formatDateTime(testTs), "2026-09-02 14:05");
    });

    it("formats time", () => {
      assert.equal(formatTime(testTs), "14:05");
    });

    it("formats diary parts", () => {
      assert.deepEqual(formatDiaryDateParts(testTs), {
        day: "02",
        month: "9月",
        year: "2026",
      });
    });

    it("gets space year", () => {
      assert.equal(getSpaceYear(testTs), 2026);
    });

    it("formats relative time for same day and different day", () => {
      // Reference is 2026-09-02 18:00:00 CST
      const refTs = Date.UTC(2026, 8, 2, 10, 0, 0) / 1000;

      // Same day event -> HH:mm
      assert.equal(formatRelativeTime(testTs, refTs), "14:05");

      // Previous day event -> M月D日
      const prevDayTs = Date.UTC(2026, 8, 1, 6, 5, 9) / 1000;
      assert.equal(formatRelativeTime(prevDayTs, refTs), "9月1日");
    });

    it("correctly identifies same space day", () => {
      const ts1 = Date.UTC(2026, 8, 1, 16, 1, 0) / 1000; // 2026-09-02 00:01 CST
      const ts2 = Date.UTC(2026, 8, 2, 15, 59, 0) / 1000; // 2026-09-02 23:59 CST
      const ts3 = Date.UTC(2026, 8, 1, 15, 59, 0) / 1000; // 2026-09-01 23:59 CST

      assert.equal(isSameSpaceDay(ts1, ts2), true);
      assert.equal(isSameSpaceDay(ts1, ts3), false);
    });
  });
});
