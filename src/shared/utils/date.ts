/**
 * 空间统一基准时区核心库 (Unified Space Timezone Toolkit)
 *
 * 第一性原理：
 * 1. Orbit 为专属双人情侣空间，全局业务日历日（今日卡片、在一起天数、热力图、日记日界等）
 *    及时间展示严格统一以「北京时间 (Asia/Shanghai, UTC+8)」为单一事实来源。
 * 2. 绝对时间点在数据库与网络传输中统一使用 Unix Epoch 时间戳（秒/毫秒）。
 * 3. 严禁在业务层直接调用未经时区转换的原生 UTC/本地方法（如 `toISOString().slice(0, 10)` 或混用本地时分）。
 */

export const SPACE_TIME_ZONE = "Asia/Shanghai";
export const SPACE_TZ_OFFSET_HOURS = 8;
export const SPACE_TZ_OFFSET_SECONDS = 8 * 3600;
export const SPACE_TZ_OFFSET_MS = 8 * 3600 * 1000;

export const WEEKDAYS_CN = [
  "星期日",
  "星期一",
  "星期二",
  "星期三",
  "星期四",
  "星期五",
  "星期六",
] as const;

export interface SpaceDateParts {
  y: number;
  m: number;
  day: number;
  hours: number;
  minutes: number;
  seconds: number;
  weekday: number;
  weekdayCn: string;
  dateKey: string;
}

/**
 * 将 Unix 时间戳（秒）转换为空间基准时区（UTC+8）的分量
 */
export function getSpaceDateParts(
  ts: number = Math.floor(Date.now() / 1000)
): SpaceDateParts {
  const d = new Date((ts + SPACE_TZ_OFFSET_SECONDS) * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  const hours = d.getUTCHours();
  const minutes = d.getUTCMinutes();
  const seconds = d.getUTCSeconds();
  const weekday = d.getUTCDay();
  const weekdayCn = WEEKDAYS_CN[weekday] || "";
  const dateKey = `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;

  return {
    y,
    m,
    day,
    hours,
    minutes,
    seconds,
    weekday,
    weekdayCn,
    dateKey,
  };
}

/**
 * 获取空间基准时区下的当前日历日 key（YYYY-MM-DD）
 * 0 点即时切换，不受客户端或服务器本地时区影响
 */
export function getSpaceTodayKey(
  referenceTs: number = Math.floor(Date.now() / 1000)
): string {
  return getSpaceDateParts(referenceTs).dateKey;
}

/**
 * 获取空间基准时区下的当前年份
 */
export function getSpaceYear(
  referenceTs: number = Math.floor(Date.now() / 1000)
): number {
  return getSpaceDateParts(referenceTs).y;
}

/**
 * Unix 时间戳（秒） → 空间基准时区 YYYY-MM-DD
 */
export function unixToDateKey(ts: number): string {
  return getSpaceDateParts(ts).dateKey;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * 校验并规范化 YYYY-MM-DD 日历日 key
 */
export function parseDateKey(value?: string | null): string | null {
  const trimmed = value?.trim();
  if (!trimmed || !DATE_KEY_PATTERN.test(trimmed)) return null;

  const [y, m, d] = trimmed.split("-").map(Number);
  const ms = Date.UTC(y, m - 1, d);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== y ||
    check.getUTCMonth() !== m - 1 ||
    check.getUTCDate() !== d
  ) {
    return null;
  }

  return trimmed;
}

/**
 * 空间日历日 YYYY-MM-DD → 空间 00:00:00 的 Unix 时间戳（秒）
 */
export function dateKeyToUnix(dateKey: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 1000) - SPACE_TZ_OFFSET_SECONDS;
}

/**
 * 空间日历日 YYYY-MM-DD → 空间 23:59:59 的 Unix 时间戳（秒）
 */
export function dateKeyToEndOfDayUnix(dateKey: string): number {
  return dateKeyToUnix(dateKey) + 86_400 - 1;
}

/**
 * 空间日历日加减天数
 */
export function addDays(dateKey: string, delta: number): string {
  return unixToDateKey(dateKeyToUnix(dateKey) + delta * 86_400);
}

/**
 * 获取向前 N 天的起始 Unix 时间戳（秒）
 */
export function getSpaceRangeStartUnix(
  days: number,
  referenceTs: number = Math.floor(Date.now() / 1000)
): number {
  const today = getSpaceTodayKey(referenceTs);
  return dateKeyToUnix(addDays(today, -(days - 1)));
}

/**
 * 格式化 Unix 时间戳为 YYYY-MM-DD（空间时区日界）
 */
export function formatDate(ts: number): string {
  return getSpaceDateParts(ts).dateKey;
}

/**
 * 格式化 Unix 时间戳为中文日期（用于标题或卡片展示）
 */
export function formatDateCn(ts: number): string {
  const { y, m, day } = getSpaceDateParts(ts);
  return `${y} 年 ${m} 月 ${day} 日`;
}

/**
 * 格式化带星期的中文日期（用于无自定义标题时的封面标题）
 */
export function formatDateWithWeekday(ts: number): string {
  const { y, m, day, weekdayCn } = getSpaceDateParts(ts);
  return `${y} 年 ${m} 月 ${day} 日 · ${weekdayCn}`;
}

/**
 * 格式化 Unix 时间戳为 YYYY-MM-DD HH:mm（空间统一时区）
 */
export function formatDateTime(ts: number): string {
  const { y, m, day, hours, minutes } = getSpaceDateParts(ts);
  const mm = String(m).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  const hh = String(hours).padStart(2, "0");
  const min = String(minutes).padStart(2, "0");
  return `${y}-${mm}-${dd} ${hh}:${min}`;
}

/**
 * 格式化 Unix 时间戳为 HH:mm（空间统一时区）
 */
export function formatTime(ts: number): string {
  const { hours, minutes } = getSpaceDateParts(ts);
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

/**
 * 日记列表左栏分量：日 / 月 / 年（空间统一时区）
 */
export function formatDiaryDateParts(ts: number): {
  day: string;
  month: string;
  year: string;
} {
  const { y, m, day } = getSpaceDateParts(ts);
  return {
    day: String(day).padStart(2, "0"),
    month: `${m}月`,
    year: String(y),
  };
}

/**
 * 相对时间格式化（支持会话列表、评论、通知）
 */
export function formatRelativeTime(
  tsOrDate?: number | string | Date | null,
  referenceTs: number = Math.floor(Date.now() / 1000)
): string {
  if (!tsOrDate) return "";

  let tsSec: number;
  if (typeof tsOrDate === "number") {
    tsSec = tsOrDate > 1e11 ? Math.floor(tsOrDate / 1000) : tsOrDate;
  } else if (typeof tsOrDate === "string") {
    const parsed = new Date(tsOrDate).getTime();
    if (Number.isNaN(parsed)) return "";
    tsSec = Math.floor(parsed / 1000);
  } else if (tsOrDate instanceof Date) {
    if (Number.isNaN(tsOrDate.getTime())) return "";
    tsSec = Math.floor(tsOrDate.getTime() / 1000);
  } else {
    return "";
  }

  const itemParts = getSpaceDateParts(tsSec);
  const todayKey = getSpaceTodayKey(referenceTs);

  if (itemParts.dateKey === todayKey) {
    const hh = String(itemParts.hours).padStart(2, "0");
    const min = String(itemParts.minutes).padStart(2, "0");
    return `${hh}:${min}`;
  }

  return `${itemParts.m}月${itemParts.day}日`;
}

/**
 * 判断两个 Unix 时间戳是否落在空间基准时区的同一自然日
 */
export function isSameSpaceDay(a: number, b: number): boolean {
  return unixToDateKey(a) === unixToDateKey(b);
}

/**
 * 判断 updatedAt 是否实质性晚于 createdAt
 */
export function wasEdited(createdAt?: number, updatedAt?: number): boolean {
  if (createdAt == null || updatedAt == null) return false;
  return updatedAt - createdAt > 1;
}


/**
 * 将 AI 工具输入的日期解析为 entry_date（空间 00:00:00 Unix 秒）
 */
export function resolveEntryDate(
  dateKey?: string,
  referenceTs: number = Math.floor(Date.now() / 1000)
): number {
  const parsed = parseDateKey(dateKey);
  const key = parsed ?? getSpaceTodayKey(referenceTs);
  return dateKeyToUnix(key);
}

/**
 * 格式化 write_content 审批卡片上的日期标签
 */
export function formatWriteContentDateLabel(
  dateKey?: string,
  action?: string,
  referenceTs: number = Math.floor(Date.now() / 1000)
): string | undefined {
  const parsed = parseDateKey(dateKey);
  if (parsed) return parsed;
  if (action === "create") {
    return `${getSpaceTodayKey(referenceTs)}（今天）`;
  }
  return undefined;
}

/* ==========================================================================
 * 向后兼容别名 (Backward-Compatibility Aliases)
 * ========================================================================== */

export const BEIJING_OFFSET_SECONDS = SPACE_TZ_OFFSET_SECONDS;
export const beijingDateParts = getSpaceDateParts;
export const beijingDateKeyFromUnix = unixToDateKey;
export const beijingTodayKey = getSpaceTodayKey;
export const beijingStartOfDayUnix = dateKeyToUnix;
export const beijingEndOfDayUnix = dateKeyToEndOfDayUnix;
export const addBeijingDays = addDays;
export const beijingRangeStartUnix = getSpaceRangeStartUnix;
export const parseBeijingDateKey = parseDateKey;
export const isSameLocalDay = isSameSpaceDay;

