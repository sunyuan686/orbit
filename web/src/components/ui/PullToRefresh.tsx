import React, { useEffect, useRef, useState } from "react";
import { CheckIcon, AlertIcon } from "../OrbitIcons";
import { useToast } from "../../hooks/useToast";
import { getApiErrorMessage } from "../../lib/api";

export interface PullToRefreshProps {
  /** 刷新回调函数，支持返回 Promise */
  onRefresh: () => Promise<unknown> | void;
  /** 子节点内容 */
  children: React.ReactNode;
  /** 可选样式名 */
  className?: string;
  /** 是否禁用下拉刷新 */
  disabled?: boolean;
  /** 可选绑定的 TabKey，绑定后可在已处于顶部再次点击底栏时同步触发动画与刷新 */
  tabKey?: string;
}

type RefreshStatus = "idle" | "pulling" | "refreshing" | "success" | "error";

const PULL_THRESHOLD = 56;
const MAX_PULL = 84;
const REFRESH_HOLD = 46;

function getScrollParent(node: HTMLElement | null): HTMLElement | Window {
  let curr = node?.parentElement;
  while (curr && curr !== document.body) {
    const style = window.getComputedStyle(curr);
    if (style.overflowY === "auto" || style.overflowY === "scroll") {
      return curr;
    }
    curr = curr.parentElement;
  }
  return window;
}

/**
 * 极简且具备确定性状态反馈的下拉刷新组件
 * 遵循 Orbit Design System 60-30-10 极简美学与 Zero-Manual UI 原则：
 * 1. 纯 Touch 事件监听，仅在 scrollTop <= 0 且垂直向下拉动时捕获；
 * 2. 状态机闭环：idle -> pulling -> refreshing -> success (对勾+微触觉) / error (叹号+Toast报错)；
 * 3. 纯 GPU 合成层变换（translate3d），闲置态完全剥离 transform，零样式副作用。
 */
export function PullToRefresh({
  onRefresh,
  children,
  className = "",
  disabled = false,
  tabKey,
}: PullToRefreshProps) {
  const toast = useToast();
  const containerRef = useRef<HTMLDivElement | null>(null);
  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const [pullDistance, setPullDistance] = useState(0);
  const [status, setStatus] = useState<RefreshStatus>("idle");
  const [isDragging, setIsDragging] = useState(false);

  const touchStartRef = useRef<{ x: number; y: number } | null>(null);
  const isPullingRef = useRef(false);
  const hasVibratedRef = useRef(false);
  const isRefreshingRef = useRef(false);
  isRefreshingRef.current = status === "refreshing" || status === "success" || status === "error";

  const executeRefresh = async () => {
    if (isRefreshingRef.current) return;
    isRefreshingRef.current = true;
    setStatus("refreshing");
    setPullDistance(REFRESH_HOLD);

    const startTime = Date.now();
    try {
      await Promise.resolve(onRefreshRef.current());
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 260 - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      // 成功终态反馈：微触觉 + 极简微对勾
      setStatus("success");
      try {
        navigator.vibrate?.(12);
      } catch {
        // 忽略不支持触觉反馈的环境
      }

      // 保持 350ms 成功态，让用户视觉明确闭环
      await new Promise((resolve) => setTimeout(resolve, 350));
    } catch (err) {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 260 - elapsed);
      if (remaining > 0) {
        await new Promise((resolve) => setTimeout(resolve, remaining));
      }

      // 失败终态反馈：警告色叹号 + 告警震动 + 明确 Toast 报错，绝不静默失效
      setStatus("error");
      try {
        navigator.vibrate?.([20, 40, 20]);
      } catch {
        // 忽略不支持触觉反馈的环境
      }
      toast.error(getApiErrorMessage(err, "刷新失败，请稍后重试"));

      // 保持 450ms 错误态
      await new Promise((resolve) => setTimeout(resolve, 450));
    } finally {
      setPullDistance(0);
      setTimeout(() => {
        setStatus("idle");
        isRefreshingRef.current = false;
      }, 240);
    }
  };

  // 支持外部广播（例如双击底栏已在顶部）触发刷新动画
  useEffect(() => {
    if (!tabKey) return;

    const handleExternalRefresh = (e: Event) => {
      const customEvent = e as CustomEvent<{ tab?: string }>;
      if (customEvent.detail?.tab === tabKey && !isRefreshingRef.current) {
        void executeRefresh();
      }
    };

    window.addEventListener("orbit:refresh-active-tab", handleExternalRefresh);
    return () => {
      window.removeEventListener("orbit:refresh-active-tab", handleExternalRefresh);
    };
  }, [tabKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el || disabled) return;

    const onTouchStart = (e: TouchEvent) => {
      if (isRefreshingRef.current || e.touches.length !== 1) return;

      const scrollEl = getScrollParent(el);
      const scrollTop = scrollEl instanceof Window ? window.scrollY : scrollEl.scrollTop;

      // 仅在视口已处于顶部时，才记录手势起始点
      if (scrollTop <= 1) {
        touchStartRef.current = {
          x: e.touches[0].clientX,
          y: e.touches[0].clientY,
        };
        isPullingRef.current = false;
        hasVibratedRef.current = false;
      } else {
        touchStartRef.current = null;
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (!touchStartRef.current || isRefreshingRef.current || e.touches.length !== 1) return;

      const deltaY = e.touches[0].clientY - touchStartRef.current.y;
      const deltaX = e.touches[0].clientX - touchStartRef.current.x;

      if (!isPullingRef.current) {
        // 用户在上滑翻阅历史，或横向手势为主（如侧滑返回），放弃拦截
        if (deltaY <= 0 || Math.abs(deltaX) >= Math.abs(deltaY)) {
          touchStartRef.current = null;
          return;
        }

        const scrollEl = getScrollParent(el);
        const scrollTop = scrollEl instanceof Window ? window.scrollY : scrollEl.scrollTop;

        // 确认有效下拉且已在顶部
        if (scrollTop <= 1 && deltaY > 6) {
          isPullingRef.current = true;
          setIsDragging(true);
          setStatus("pulling");
        }
      }

      if (isPullingRef.current) {
        // 阻止移动端浏览器原生弹性下拉冲突
        if (e.cancelable) {
          e.preventDefault();
        }

        // 渐进阻尼衰减算法
        const distance = Math.max(0, Math.min(MAX_PULL, deltaY * 0.42));
        setPullDistance(distance);

        // 达到阈值时触发微弱震动反馈（仅触发一次）
        if (distance >= PULL_THRESHOLD && !hasVibratedRef.current) {
          hasVibratedRef.current = true;
          try {
            navigator.vibrate?.(10);
          } catch {
            // 忽略不支持震动的环境
          }
        } else if (distance < PULL_THRESHOLD) {
          hasVibratedRef.current = false;
        }
      }
    };

    const onTouchEnd = () => {
      if (!isPullingRef.current) {
        touchStartRef.current = null;
        return;
      }

      isPullingRef.current = false;
      setIsDragging(false);
      touchStartRef.current = null;

      if (pullDistance >= PULL_THRESHOLD) {
        void executeRefresh();
      } else {
        setPullDistance(0);
        setStatus("idle");
      }
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });

    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, [disabled, pullDistance]);

  const isOperating = status !== "idle";

  return (
    <div
      ref={containerRef}
      className={`orbit-pull-to-refresh relative w-full ${className}`}
    >
      {/* 居中浮动微指示器 */}
      <div
        aria-hidden="true"
        className="orbit-pull-indicator pointer-events-none absolute left-0 right-0 -top-11 flex items-center justify-center z-20"
        style={{
          transform: `translate3d(0, ${pullDistance}px, 0)`,
          opacity:
            pullDistance > 6
              ? Math.min(1, pullDistance / (PULL_THRESHOLD * 0.75))
              : isOperating
              ? 1
              : 0,
          transition: isDragging
            ? "none"
            : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1), opacity 0.2s ease",
        }}
      >
        <div
          className={`w-8 h-8 rounded-full bg-[var(--color-surface)] border shadow-sm flex items-center justify-center transition-colors duration-200 ${
            status === "error"
              ? "border-[var(--color-danger)] text-[var(--color-danger)]"
              : status === "success"
              ? "border-[var(--color-border)] text-[var(--color-accent)]"
              : "border-[var(--color-border)] text-[var(--color-text-secondary)]"
          }`}
        >
          {status === "error" ? (
            <AlertIcon size="sm" className="w-3.5 h-3.5 stroke-[2]" />
          ) : status === "success" ? (
            <CheckIcon size="sm" className="w-3.5 h-3.5 stroke-[2.2]" />
          ) : (
            <span
              className={`orbit-ui-btn-spinner${status === "refreshing" ? "" : " animate-none"}`}
              style={{
                width: "14px",
                height: "14px",
                borderWidth: "1.5px",
                transform:
                  status === "refreshing"
                    ? undefined
                    : `rotate(${(pullDistance / PULL_THRESHOLD) * 270}deg)`,
              }}
            />
          )}
        </div>
      </div>

      {/* 视图内容变换层（闲置态完全不加 transform，保证最高保真度与绝对干净的渲染层） */}
      <div
        className="orbit-pull-content w-full"
        style={{
          transform:
            pullDistance > 0
              ? `translate3d(0, ${pullDistance}px, 0)`
              : undefined,
          transition: isDragging
            ? "none"
            : "transform 0.25s cubic-bezier(0.2, 0.8, 0.2, 1)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
