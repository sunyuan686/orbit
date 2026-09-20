// 内存级滚动位置映射表：以 history entry 的 location.key 为索引。
// 随浏览器标签页生命周期回收，开销极小且无副作用。
const scrollPositions = new Map<string, number>();

export function saveScrollPosition(key: string, top: number): void {
  scrollPositions.set(key, Math.max(0, top));
}

export function getSavedScrollPosition(key: string): number | undefined {
  return scrollPositions.get(key);
}

export function clearScrollPositions(): void {
  scrollPositions.clear();
}
