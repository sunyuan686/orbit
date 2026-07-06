/** 北京时间（UTC+8）日历日，与前端 `formatDate` 对齐 */

const BEIJING_OFFSET_SECONDS = 8 * 3600;

export function beijingDateKeyFromUnix(ts: number): string {
  const d = new Date((ts + BEIJING_OFFSET_SECONDS) * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

export function beijingTodayKey(referenceTs = Math.floor(Date.now() / 1000)): string {
  return beijingDateKeyFromUnix(referenceTs);
}

export function beijingStartOfDayUnix(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 1000) - BEIJING_OFFSET_SECONDS;
}

export function beijingEndOfDayUnix(dateKey: string): number {
  return beijingStartOfDayUnix(dateKey) + 86_400 - 1;
}

export function addBeijingDays(dateKey: string, delta: number): string {
  return beijingDateKeyFromUnix(beijingStartOfDayUnix(dateKey) + delta * 86_400);
}

export function beijingRangeStartUnix(days: number, referenceTs = Math.floor(Date.now() / 1000)): number {
  const today = beijingTodayKey(referenceTs);
  return beijingStartOfDayUnix(addBeijingDays(today, -(days - 1)));
}
