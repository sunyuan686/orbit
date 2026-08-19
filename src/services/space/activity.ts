import { and, asc, gte, inArray, isNull, lte } from "drizzle-orm";
import { entry } from "../../db/schema.js";
import {
  addBeijingDays,
  beijingDateKeyFromUnix,
  beijingEndOfDayUnix,
  beijingRangeStartUnix,
  beijingStartOfDayUnix,
  beijingTodayKey,
} from "../../lib/beijing-date.js";

export const ACTIVITY_ENTRY_TYPES = ["diary", "timeline", "message", "letter"] as const;

export type ActivityEntryType = (typeof ACTIVITY_ENTRY_TYPES)[number];

export interface ActivityDayCount {
  date: string;
  count: number;
}

export interface ActivityStreak {
  current: number;
  longest: number;
}

export interface ActivitySummary {
  activeDays: number;
  totalEntries: number;
  rangeDays: number;
}

export interface ActivityStats {
  days: ActivityDayCount[];
  streak: ActivityStreak;
  summary: ActivitySummary;
}

export interface ActivityDayEntry {
  id: string;
  type: string;
  title: string | null;
  author: string;
  entryDate: number | null;
}

function aggregateCounts(entryDates: Array<number | null>): Map<string, number> {
  const counts = new Map<string, number>();
  for (const ts of entryDates) {
    if (ts == null) continue;
    const key = beijingDateKeyFromUnix(ts);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function fillDaySeries(
  counts: Map<string, number>,
  rangeDays: number,
  referenceTs = Math.floor(Date.now() / 1000)
): ActivityDayCount[] {
  const today = beijingTodayKey(referenceTs);
  const start = addBeijingDays(today, -(rangeDays - 1));
  const days: ActivityDayCount[] = [];
  let cursor = start;
  while (cursor <= today) {
    days.push({ date: cursor, count: counts.get(cursor) ?? 0 });
    cursor = addBeijingDays(cursor, 1);
  }
  return days;
}

/** GitHub 式：今天未写仍计到昨天为止的连续天数 */
export function computeStreaks(
  activeDateKeys: Set<string>,
  todayKey = beijingTodayKey()
): ActivityStreak {
  if (activeDateKeys.size === 0) {
    return { current: 0, longest: 0 };
  }

  const sorted = [...activeDateKeys].sort();
  let longest = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (addBeijingDays(sorted[i - 1], 1) === sorted[i]) {
      run += 1;
      longest = Math.max(longest, run);
    } else {
      run = 1;
    }
  }

  let anchor = todayKey;
  if (!activeDateKeys.has(todayKey)) {
    anchor = addBeijingDays(todayKey, -1);
  }

  let current = 0;
  if (activeDateKeys.has(anchor)) {
    let cursor = anchor;
    while (activeDateKeys.has(cursor)) {
      current += 1;
      cursor = addBeijingDays(cursor, -1);
    }
  }

  return { current, longest };
}

export async function getActivityStats(
  db: any,
  options: { days?: number } = {}
): Promise<ActivityStats> {
  const rangeDays = Math.min(Math.max(options.days ?? 365, 7), 730);
  const since = beijingRangeStartUnix(rangeDays);

  const rows = await db
    .select({ entryDate: entry.entryDate })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        inArray(entry.type, [...ACTIVITY_ENTRY_TYPES]),
        gte(entry.entryDate, since)
      )
    );

  const counts = aggregateCounts(rows.map((row: { entryDate: number | null }) => row.entryDate));
  const daySeries = fillDaySeries(counts, rangeDays);
  const activeDateKeys = new Set(
    daySeries.filter((day) => day.count > 0).map((day) => day.date)
  );
  const totalEntries = daySeries.reduce((sum, day) => sum + day.count, 0);

  return {
    days: daySeries,
    streak: computeStreaks(activeDateKeys),
    summary: {
      activeDays: activeDateKeys.size,
      totalEntries,
      rangeDays,
    },
  };
}

export async function getActivityDayEntries(
  db: any,
  dateKey: string
): Promise<ActivityDayEntry[]> {
  const fromTs = beijingStartOfDayUnix(dateKey);
  const toTs = beijingEndOfDayUnix(dateKey);

  return db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      author: entry.author,
      entryDate: entry.entryDate,
    })
    .from(entry)
    .where(
      and(
        isNull(entry.deletedAt),
        inArray(entry.type, [...ACTIVITY_ENTRY_TYPES]),
        gte(entry.entryDate, fromTs),
        lte(entry.entryDate, toTs)
      )
    )
    .orderBy(asc(entry.entryDate), asc(entry.createdAt));
}
