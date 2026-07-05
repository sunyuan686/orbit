import type { ActivityDayCount } from "./api";

/** ISO 周一 = 0 … 周日 = 6 */
export function mondayWeekdayIndex(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const jsDay = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
  return jsDay === 0 ? 6 : jsDay - 1;
}

export function activityLevel(count: number): 0 | 1 | 2 | 3 | 4 {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 5) return 3;
  return 4;
}

export function sliceRecentDays(days: ActivityDayCount[], dayCount: number): ActivityDayCount[] {
  if (days.length <= dayCount) return days;
  return days.slice(days.length - dayCount);
}

export type HeatmapWeek = Array<ActivityDayCount | null>;

export function buildWeekGrid(days: ActivityDayCount[]): HeatmapWeek[] {
  if (days.length === 0) return [];

  const weeks: HeatmapWeek[] = [];
  let currentWeek: HeatmapWeek = [];

  const leading = mondayWeekdayIndex(days[0].date);
  for (let i = 0; i < leading; i++) {
    currentWeek.push(null);
  }

  for (const day of days) {
    if (currentWeek.length === 7) {
      weeks.push(currentWeek);
      currentWeek = [];
    }
    currentWeek.push(day);
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) currentWeek.push(null);
    weeks.push(currentWeek);
  }

  return weeks;
}

export function formatActivityCountLabel(count: number): string {
  if (count <= 0) return "无记录";
  return `${count} 篇`;
}

export function formatActivityDateLabel(dateKey: string): string {
  const [y, m, d] = dateKey.split("-").map(Number);
  return `${y}年${m}月${d}日`;
}
