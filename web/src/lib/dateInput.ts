import {
  dateKeyToUnix,
  getSpaceTodayKey,
  parseDateKey,
  unixToDateKey,
} from "@orbit/shared";

/** Unix 秒 → 空间基准时区 YYYY-MM-DD */
export function toDateInput(ts: number): string {
  return unixToDateKey(ts);
}

/** 空间 YYYY-MM-DD → 空间 00:00:00 的 Unix 秒 */
export function fromDateInput(s: string): number {
  return dateKeyToUnix(s);
}

/** YYYY-MM-DD → Date（用于 UI 日历组件渲染） */
export function parseIsoDate(iso: string): Date | undefined {
  const valid = parseDateKey(iso);
  if (!valid) return undefined;
  const [y, m, d] = valid.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** Date（日历组件选择） → YYYY-MM-DD */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 空间今天 YYYY-MM-DD（统一空间时区） */
export function todayIsoDate(): string {
  return getSpaceTodayKey();
}
