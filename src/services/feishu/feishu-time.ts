import { dateKeyToEndOfDayUnix, dateKeyToUnix, getSpaceTodayKey } from "@orbit/shared";

export function beijingDayRange(referenceTs?: number): { start: number; end: number } {
  const todayKey = getSpaceTodayKey(referenceTs);
  const start = dateKeyToUnix(todayKey);
  const end = dateKeyToEndOfDayUnix(todayKey) + 1;
  return { start, end };
}
