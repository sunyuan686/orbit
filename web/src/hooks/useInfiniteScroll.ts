import { useCallback, useEffect, useRef } from "react";

export interface UseInfiniteScrollOptions {
  /** 是否还有下一页 */
  hasNextPage?: boolean;
  /** 是否正在拉取下一页 */
  isFetchingNextPage: boolean;
  /** 拉取下一页的方法 */
  fetchNextPage: () => Promise<unknown> | void;
  /** 是否拉取发生错误 */
  isError?: boolean;
  /** 是否启用无限滚动，默认 true */
  enabled?: boolean;
  /** 视口外边距，默认 "240px"，实现接近底部时静默预加载 */
  rootMargin?: string;
  /** 触发阈值，默认 0 */
  threshold?: number | number[];
}

export interface UseInfiniteScrollReturn {
  /** 赋给底部哨兵 DOM 元素的 Callback Ref */
  sentinelRef: (node: HTMLElement | null) => void;
  /** 手动重试函数（发生错误或需要手动拉取时） */
  retry: () => void;
}

/**
 * 轻量且健壮的无限滚动 Hook
 * 遵循第一性原理：基于 W3C 标准 IntersectionObserver + React Callback Ref
 * 具备防并发重入、动态节点挂载适应与错误熔断恢复机制。
 */
export function useInfiniteScroll({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
  isError = false,
  enabled = true,
  rootMargin = "240px",
  threshold = 0,
}: UseInfiniteScrollOptions): UseInfiniteScrollReturn {
  // 保存当前挂载的 DOM 节点
  const targetNodeRef = useRef<HTMLElement | null>(null);
  // Observer 实例
  const observerRef = useRef<IntersectionObserver | null>(null);
  // 即时同步锁，防止高频触发导致连续发送多个相同请求
  const isLockedRef = useRef(false);

  // 保证回调中读取最新配置，避免频繁解绑/重绑 Observer
  const stateRef = useRef({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isError,
    enabled,
  });
  stateRef.current = {
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
    isError,
    enabled,
  };

  // 当 isFetchingNextPage 变为 false 时释放并发锁
  useEffect(() => {
    if (!isFetchingNextPage) {
      isLockedRef.current = false;
    }
  }, [isFetchingNextPage]);

  // 触发拉取的安全执行器
  const triggerFetch = useCallback(() => {
    const { hasNextPage, isFetchingNextPage, isError, enabled, fetchNextPage } =
      stateRef.current;

    if (!enabled || !hasNextPage || isFetchingNextPage || isError || isLockedRef.current) {
      return;
    }

    isLockedRef.current = true;
    const result = fetchNextPage();
    if (result && typeof (result as Promise<unknown>).finally === "function") {
      (result as Promise<unknown>).finally(() => {
        isLockedRef.current = false;
      });
    }
  }, []);

  // 手动重试
  const retry = useCallback(() => {
    isLockedRef.current = false;
    triggerFetch();
  }, [triggerFetch]);

  // 构建或更新 IntersectionObserver
  const setupObserver = useCallback(
    (node: HTMLElement | null) => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }

      if (!node || typeof IntersectionObserver === "undefined") {
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          const entry = entries[0];
          if (entry?.isIntersecting) {
            triggerFetch();
          }
        },
        {
          root: null, // 顶级视口，兼顾移动与桌面容器滚动
          rootMargin,
          threshold,
        }
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [rootMargin, threshold, triggerFetch]
  );

  // Callback Ref：在节点挂载/卸载瞬间准确接管
  const sentinelRef = useCallback(
    (node: HTMLElement | null) => {
      targetNodeRef.current = node;
      setupObserver(node);
    },
    [setupObserver]
  );

  // 当外部依赖（如 rootMargin/threshold）改变，或当 hasNextPage 改变可能需要重新唤醒时
  useEffect(() => {
    const node = targetNodeRef.current;
    if (node) {
      setupObserver(node);
    }
    return () => {
      if (observerRef.current) {
        observerRef.current.disconnect();
        observerRef.current = null;
      }
    };
  }, [setupObserver]);

  return {
    sentinelRef,
    retry,
  };
}
