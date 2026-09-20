import React from "react";

export interface InfiniteScrollSentinelProps {
  /** 绑定的哨兵 Ref 回调（分页模式传，全量列表可缺省） */
  sentinelRef?: (node: HTMLElement | null) => void;
  /** 是否还有下一页，默认 false */
  hasNextPage?: boolean;
  /** 是否正在加载下一页，默认 false */
  isFetchingNextPage?: boolean;
  /** 是否拉取失败 */
  isError?: boolean;
  /** 重试回调 */
  onRetry?: () => void;
  /** 列表已有项目数（用于判断是否展示触底文案） */
  itemCount?: number;
  /** 触底自定义文案，默认 "· 已经看到最后了 ·" */
  endMessage?: string;
  /** 自定义类名 */
  className?: string;
}

/**
 * 统一的列表无限滚动哨兵与状态反馈组件
 * 遵循 Orbit Design System 克制留白美学：
 * - 兼顾全量列表与分页增量列表
 * - 加载中：居中微旋转动画 + 柔和提示
 * - 触底：克制点缀式终点线
 * - 异常：温和的重试入口
 */
export const InfiniteScrollSentinel: React.FC<InfiniteScrollSentinelProps> = ({
  sentinelRef,
  hasNextPage = false,
  isFetchingNextPage = false,
  isError = false,
  onRetry,
  itemCount = 0,
  endMessage = "· 已经看到最后了 ·",
  className = "",
}) => {
  return (
    <div className={`w-full flex flex-col items-center justify-center ${className}`}>
      {/* 哨兵节点：只要还有下一页且有 sentinelRef 则常驻视口检测区域 */}
      {hasNextPage && sentinelRef && (
        <div
          ref={sentinelRef}
          className="w-full h-4 pointer-events-none opacity-0 shrink-0"
          aria-hidden="true"
        />
      )}

      {/* 加载中状态 */}
      {isFetchingNextPage && (
        <div className="py-6 flex items-center justify-center gap-2 text-xs text-[var(--color-text-muted)]">
          <span
            className="orbit-ui-btn-spinner"
            style={{ width: "12px", height: "12px", borderWidth: "1.5px" }}
            aria-hidden="true"
          />
          <span>正在加载…</span>
        </div>
      )}

      {/* 出错可重试状态 */}
      {isError && !isFetchingNextPage && onRetry && (
        <div className="py-6 text-center">
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] bg-[var(--color-surface)] border border-[var(--color-border)] hover:border-[var(--color-text-muted)] transition-colors cursor-pointer shadow-sm"
          >
            <span>加载失败，点击重试</span>
          </button>
        </div>
      )}

      {/* 全部加载完毕（触底底线） */}
      {!hasNextPage && !isError && itemCount > 0 && (
        <div className="py-8 text-center text-xs tracking-widest text-[var(--color-text-muted)] font-mono opacity-80 select-none">
          {endMessage}
        </div>
      )}
    </div>
  );
};
