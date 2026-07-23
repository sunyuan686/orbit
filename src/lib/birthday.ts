export type BirthdayCalendar = "solar" | "lunar";

export interface BirthdayValue {
  calendar: BirthdayCalendar;
  month: number;
  day: number;
  leapMonth: boolean;
}

const SOLAR_DAYS = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31] as const;

export function maxDayForBirthday(
  calendar: BirthdayCalendar,
  month: number
): number {
  if (calendar === "lunar") return 30;
  if (month < 1 || month > 12) return 31;
  return SOLAR_DAYS[month - 1]!;
}

export function parseBirthdayInput(
  raw: unknown
): { ok: true; value: BirthdayValue | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (raw === undefined) {
    return { ok: false, error: "生日格式无效" };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "生日格式无效" };
  }

  const body = raw as Record<string, unknown>;
  const calendar = body.calendar;
  if (calendar !== "solar" && calendar !== "lunar") {
    return { ok: false, error: "请选择公历或农历" };
  }

  const month = Number(body.month);
  const day = Number(body.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "月份无效" };
  }
  const maxDay = maxDayForBirthday(calendar, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    return { ok: false, error: "日期无效" };
  }

  const leapMonth = Boolean(body.leapMonth);
  if (leapMonth && calendar !== "lunar") {
    return { ok: false, error: "仅农历生日可标记闰月" };
  }

  return {
    ok: true,
    value: {
      calendar,
      month,
      day,
      leapMonth: calendar === "lunar" ? leapMonth : false,
    },
  };
}

export function birthdayFromRow(row: {
  birthdayCalendar: string | null;
  birthdayMonth: number | null;
  birthdayDay: number | null;
  birthdayLeapMonth: boolean | null;
}): BirthdayValue | null {
  if (
    (row.birthdayCalendar !== "solar" && row.birthdayCalendar !== "lunar") ||
    row.birthdayMonth == null ||
    row.birthdayDay == null
  ) {
    return null;
  }
  const parsed = parseBirthdayInput({
    calendar: row.birthdayCalendar,
    month: row.birthdayMonth,
    day: row.birthdayDay,
    leapMonth: Boolean(row.birthdayLeapMonth),
  });
  return parsed.ok ? parsed.value : null;
}

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

export function formatBirthdayCn(value: BirthdayValue): string {
  if (value.calendar === "solar") {
    return `公历 ${value.month} 月 ${value.day} 日`;
  }
  const monthLabel = LUNAR_MONTH_LABELS[value.month - 1] ?? `${value.month}月`;
  const dayLabel = LUNAR_DAY_LABELS[value.day - 1] ?? `${value.day}日`;
  return value.leapMonth
    ? `农历闰${monthLabel}${dayLabel}`
    : `农历${monthLabel}${dayLabel}`;
}

export function lunarMonthLabel(month: number): string {
  return LUNAR_MONTH_LABELS[month - 1] ?? `${month}月`;
}

export function lunarDayLabel(day: number): string {
  return LUNAR_DAY_LABELS[day - 1] ?? `${day}日`;
}
