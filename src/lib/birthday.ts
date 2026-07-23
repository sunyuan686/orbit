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

function parseMonthDay(
  raw: unknown,
  calendar: BirthdayCalendar
):
  | { ok: true; value: { month: number; day: number } }
  | { ok: false; error: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, error: "生日格式无效" };
  }
  const body = raw as Record<string, unknown>;
  const month = Number(body.month);
  const day = Number(body.day);
  if (!Number.isInteger(month) || month < 1 || month > 12) {
    return { ok: false, error: "月份无效" };
  }
  const maxDay = maxDayForBirthday(calendar, month);
  if (!Number.isInteger(day) || day < 1 || day > maxDay) {
    return { ok: false, error: "日期无效" };
  }
  return { ok: true, value: { month, day } };
}

function resolveRemindCalendar(
  solar: SolarBirthday | null,
  lunar: LunarBirthday | null,
  requested: unknown
):
  | { ok: true; value: BirthdayCalendar | null }
  | { ok: false; error: string } {
  if (!solar && !lunar) return { ok: true, value: null };
  if (solar && !lunar) return { ok: true, value: "solar" };
  if (!solar && lunar) return { ok: true, value: "lunar" };

  if (requested === undefined || requested === null) {
    return { ok: true, value: "lunar" };
  }
  if (requested !== "solar" && requested !== "lunar") {
    return { ok: false, error: "请选择提醒历法" };
  }
  return { ok: true, value: requested };
}

export function parseBirthdayInput(
  raw: unknown
): { ok: true; value: BirthdayProfile | null } | { ok: false; error: string } {
  if (raw === null) return { ok: true, value: null };
  if (raw === undefined || typeof raw !== "object" || Array.isArray(raw)) {
    return { ok: false, error: "生日格式无效" };
  }

  const body = raw as Record<string, unknown>;

  let solar: SolarBirthday | null = null;
  if (body.solar !== undefined && body.solar !== null) {
    const parsed = parseMonthDay(body.solar, "solar");
    if (!parsed.ok) return parsed;
    solar = parsed.value;
  }

  let lunar: LunarBirthday | null = null;
  if (body.lunar !== undefined && body.lunar !== null) {
    const parsed = parseMonthDay(body.lunar, "lunar");
    if (!parsed.ok) return parsed;
    const leapMonth = Boolean(
      (body.lunar as Record<string, unknown>).leapMonth
    );
    lunar = { ...parsed.value, leapMonth };
  }

  if (!solar && !lunar) return { ok: true, value: null };

  const remind = resolveRemindCalendar(solar, lunar, body.remindCalendar);
  if (!remind.ok) return remind;

  return {
    ok: true,
    value: {
      solar,
      lunar,
      remindCalendar: remind.value ?? "lunar",
    },
  };
}

export function birthdayFromRow(row: {
  birthdaySolarMonth: number | null;
  birthdaySolarDay: number | null;
  birthdayLunarMonth: number | null;
  birthdayLunarDay: number | null;
  birthdayLunarLeapMonth: boolean | null;
  birthdayRemindCalendar: string | null;
}): BirthdayProfile | null {
  let solar: SolarBirthday | null = null;
  if (row.birthdaySolarMonth != null && row.birthdaySolarDay != null) {
    const parsed = parseMonthDay(
      { month: row.birthdaySolarMonth, day: row.birthdaySolarDay },
      "solar"
    );
    if (parsed.ok) solar = parsed.value;
  }

  let lunar: LunarBirthday | null = null;
  if (row.birthdayLunarMonth != null && row.birthdayLunarDay != null) {
    const parsed = parseMonthDay(
      { month: row.birthdayLunarMonth, day: row.birthdayLunarDay },
      "lunar"
    );
    if (parsed.ok) {
      lunar = {
        ...parsed.value,
        leapMonth: Boolean(row.birthdayLunarLeapMonth),
      };
    }
  }

  if (!solar && !lunar) return null;

  const remind = resolveRemindCalendar(
    solar,
    lunar,
    row.birthdayRemindCalendar
  );
  return {
    solar,
    lunar,
    remindCalendar: remind.ok && remind.value ? remind.value : solar ? "solar" : "lunar",
  };
}

export function formatSolarBirthdayCn(value: SolarBirthday): string {
  return `公历 ${value.month} 月 ${value.day} 日`;
}

export function formatLunarBirthdayCn(value: LunarBirthday): string {
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
