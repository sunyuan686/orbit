const BEIJING_OFFSET_SECONDS = 8 * 3600;

export function beijingDayRange(): { start: number; end: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const beijingNow = nowSec + BEIJING_OFFSET_SECONDS;
  const dayStartBeijing = beijingNow - (beijingNow % 86400);
  const start = dayStartBeijing - BEIJING_OFFSET_SECONDS;
  return { start, end: start + 86400 };
}
