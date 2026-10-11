const STORAGE_KEY = "orbit_scroll_positions";

// 内存级滚动位置映射表：以 history entry 的 location.key 为索引。
// 同时持久化至 sessionStorage，实现跨刷新、PWA 热重载与会话内生命周期持久化。
const scrollPositions = new Map<string, number>();

if (typeof window !== "undefined" && window.sessionStorage) {
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed === "object" && parsed !== null) {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === "number" && Number.isFinite(v)) {
            scrollPositions.set(k, Math.max(0, v));
          }
        }
      }
    }
  } catch {
    // sessionStorage 不可用或解析失败时静默降级为纯内存 Map
  }
}

function syncToSessionStorage(): void {
  if (typeof window === "undefined" || !window.sessionStorage) return;
  try {
    const obj: Record<string, number> = {};
    for (const [k, v] of scrollPositions.entries()) {
      obj[k] = v;
    }
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
  } catch {
    // 忽略 QuotaExceededError 等异常
  }
}

export function saveScrollPosition(key: string, top: number): void {
  scrollPositions.set(key, Math.max(0, top));
  syncToSessionStorage();
}

export function getSavedScrollPosition(key: string): number | undefined {
  return scrollPositions.get(key);
}

export function clearScrollPositions(): void {
  scrollPositions.clear();
  if (typeof window !== "undefined" && window.sessionStorage) {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
  }
}
