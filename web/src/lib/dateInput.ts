/** Unix 秒 → YYYY-MM-DD（本地时区） */
export function toDateInput(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** YYYY-MM-DD → 当地 00:00 的 Unix 秒 */
export function fromDateInput(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(new Date(y, m - 1, d).getTime() / 1000);
}

/** YYYY-MM-DD → Date（本地时区，仅日期部分） */
export function parseIsoDate(iso: string): Date | undefined {
  if (!iso) return undefined;
  const [y, m, d] = iso.split("-").map(Number);
  if ([y, m, d].some((n) => Number.isNaN(n))) return undefined;
  return new Date(y, m - 1, d);
}

/** Date → YYYY-MM-DD（本地时区） */
export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** 今天 YYYY-MM-DD（本地时区） */
export function todayIsoDate(): string {
  return toIsoDate(new Date());
}
