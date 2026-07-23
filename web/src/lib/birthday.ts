export type BirthdayCalendar = "solar" | "lunar";

export interface BirthdayValue {
  calendar: BirthdayCalendar;
  month: number;
  day: number;
  leapMonth: boolean;
}

export type BirthdayView = BirthdayValue & { label: string };

const SOLAR_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

const LUNAR_MONTH_LABELS = [
  "正月",
  "二月",
  "三月",
  "四月",
  "五月",
  "六月",
  "七月",
  "八月",
  "九月",
  "十月",
  "冬月",
  "腊月",
] as const;

const LUNAR_DAY_LABELS = [
  "初一",
  "初二",
  "初三",
  "初四",
  "初五",
  "初六",
  "初七",
  "初八",
  "初九",
  "初十",
  "十一",
  "十二",
  "十三",
  "十四",
  "十五",
  "十六",
  "十七",
  "十八",
  "十九",
  "二十",
  "廿一",
  "廿二",
  "廿三",
  "廿四",
  "廿五",
  "廿六",
  "廿七",
  "廿八",
  "廿九",
  "三十",
] as const;

export function maxDayForBirthday(
  calendar: BirthdayCalendar,
  month: number
): number {
  if (calendar === "lunar") return 30;
  if (month < 1 || month > 12) return 31;
  return SOLAR_DAYS[month - 1]!;
}

export function lunarMonthLabel(month: number): string {
  return LUNAR_MONTH_LABELS[month - 1] ?? `${month}月`;
}

export function lunarDayLabel(day: number): string {
  return LUNAR_DAY_LABELS[day - 1] ?? `${day}日`;
}

export function birthdayEquals(
  a: BirthdayValue | null,
  b: BirthdayValue | null
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;
  return (
    a.calendar === b.calendar &&
    a.month === b.month &&
    a.day === b.day &&
    Boolean(a.leapMonth) === Boolean(b.leapMonth)
  );
}

export function defaultBirthdayDraft(
  calendar: BirthdayCalendar = "lunar"
): BirthdayValue {
  return { calendar, month: 1, day: 1, leapMonth: false };
}
