const BEIJING_OFFSET_SECONDS = 8 * 3600;

export function beijingTodayKey(referenceTs = Math.floor(Date.now() / 1000)): string {
  const d = new Date((referenceTs + BEIJING_OFFSET_SECONDS) * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseBeijingDateKey(value?: string): string | null {
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

export function formatWriteContentDateLabel(
  dateKey?: string,
  action?: string,
  referenceTs = Math.floor(Date.now() / 1000)
): string | undefined {
  const parsed = parseBeijingDateKey(dateKey);
  if (parsed) return parsed;
  if (action === "create") {
    return `${beijingTodayKey(referenceTs)}（今天）`;
  }
  return undefined;
}
