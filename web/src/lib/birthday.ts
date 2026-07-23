export type BirthdayCalendar = "solar" | "lunar";

export interface SolarBirthday {
  month: number;
  day: number;
}

export interface LunarBirthday {
  month: number;
  day: number;
  leapMonth: boolean;
}

export interface BirthdayProfile {
  solar: SolarBirthday | null;
  lunar: LunarBirthday | null;
  remindCalendar: BirthdayCalendar;
}

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
  a: BirthdayProfile | null,
  b: BirthdayProfile | null
): boolean {
  if (a == null && b == null) return true;
  if (a == null || b == null) return false;

  const solarEqual =
    (a.solar == null && b.solar == null) ||
    (a.solar != null &&
      b.solar != null &&
      a.solar.month === b.solar.month &&
      a.solar.day === b.solar.day);

  const lunarEqual =
    (a.lunar == null && b.lunar == null) ||
    (a.lunar != null &&
      b.lunar != null &&
      a.lunar.month === b.lunar.month &&
      a.lunar.day === b.lunar.day &&
      Boolean(a.lunar.leapMonth) === Boolean(b.lunar.leapMonth));

  return (
    solarEqual && lunarEqual && a.remindCalendar === b.remindCalendar
  );
}

export function defaultBirthdayDraft(): BirthdayProfile {
  return {
    solar: null,
    lunar: { month: 1, day: 1, leapMonth: false },
    remindCalendar: "lunar",
  };
}

export function defaultSolarDraft(): SolarBirthday {
  return { month: 1, day: 1 };
}

export function defaultLunarDraft(): LunarBirthday {
  return { month: 1, day: 1, leapMonth: false };
}

export function resolveRemindCalendar(
  solar: SolarBirthday | null,
  lunar: LunarBirthday | null,
  preferred: BirthdayCalendar
): BirthdayCalendar {
  if (solar && lunar) return preferred;
  if (solar) return "solar";
  return "lunar";
}
