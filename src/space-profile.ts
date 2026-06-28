export const SPACE_SETTING_KEYS = {
  anniversaryDate: "anniversary_date",
  slogan: "space_slogan",
} as const;

export interface SpaceProfile {
  anniversaryDate: string | null;
  slogan: string | null;
  daysTogether: number | null;
}

const COMPACT_DATE = /^(\d{4})(\d{2})(\d{2})$/;
const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/;

export function parseAnniversaryToIso(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  const compact = COMPACT_DATE.exec(trimmed);
  if (compact) {
    return toIsoDate(Number(compact[1]), Number(compact[2]), Number(compact[3]));
  }

  const iso = ISO_DATE.exec(trimmed);
  if (iso) {
    return toIsoDate(Number(iso[1]), Number(iso[2]), Number(iso[3]));
  }

  return null;
}

export function formatAnniversaryForStorage(isoDate: string): string | null {
  const parsed = parseAnniversaryToIso(isoDate);
  if (!parsed) return null;
  return parsed.replace(/-/g, "");
}

const MS_PER_DAY = 86_400_000;
const DEFAULT_TIME_ZONE = "Asia/Shanghai";

function calendarIsoToUtcMs(iso: string): number | null {
  const [year, month, day] = iso.split("-").map(Number);
  if ([year, month, day].some((n) => Number.isNaN(n))) return null;
  return Date.UTC(year, month - 1, day);
}

function formatCalendarIsoInTimeZone(
  date: Date,
  timeZone = DEFAULT_TIME_ZONE
): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone }).format(date);
}

export function computeDaysTogether(
  anniversaryIso: string,
  referenceDate = new Date(),
  timeZone = DEFAULT_TIME_ZONE
): number | null {
  const parsed = parseAnniversaryToIso(anniversaryIso);
  if (!parsed) return null;

  const startMs = calendarIsoToUtcMs(parsed);
  if (startMs === null) return null;

  const todayMs = calendarIsoToUtcMs(
    formatCalendarIsoInTimeZone(referenceDate, timeZone)
  );
  if (todayMs === null || startMs > todayMs) return null;

  return Math.floor((todayMs - startMs) / MS_PER_DAY) + 1;
}

export function buildSpaceProfile(
  settingsMap: Record<string, string>,
  referenceDate = new Date()
): SpaceProfile {
  const anniversaryDate = parseAnniversaryToIso(
    settingsMap[SPACE_SETTING_KEYS.anniversaryDate]
  );
  const slogan = normalizeSlogan(settingsMap[SPACE_SETTING_KEYS.slogan]);
  const daysTogether = anniversaryDate
    ? computeDaysTogether(anniversaryDate, referenceDate)
    : null;

  return { anniversaryDate, slogan, daysTogether };
}

export function normalizeSlogan(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  return trimmed || null;
}

function toIsoDate(year: number, month: number, day: number): string | null {
  const date = new Date(year, month - 1, day);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  const mm = String(month).padStart(2, "0");
  const dd = String(day).padStart(2, "0");
  return `${year}-${mm}-${dd}`;
}
