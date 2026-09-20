import React, { useEffect, useRef, useState } from "react";
import { CloseIcon } from "../OrbitIcons";

export interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  children: React.ReactNode;
  maxHeight?: string;
  hideCloseButton?: boolean;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = "88vh",
  hideCloseButton = false,
}: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [sheetHeight, setSheetHeight] = useState<number | null>(null);
  const [translateY, setTranslateY] = useState(0);
  const [isDragging, setIsDragging] = useState(false);

  const startYRef = useRef(0);
  const startHeightRef = useRef(0);
  const isDraggingRef = useRef(false);
  const hasMovedRef = useRef(false);
  const lastDeltaYRef = useRef(0);

  // 当弹窗关闭时重置状态
  useEffect(() => {
    if (!isOpen) {
      setSheetHeight(null);
      setTranslateY(0);
      setIsDragging(false);
    }
  }, [isOpen]);

  // 阻止背景滚动并支持 Escape 键退出
  useEffect(() => {
    if (!isOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const target = e.currentTarget;
    try {
      target.setPointerCapture(e.pointerId);
    } catch {
      // 忽略不支持 PointerCapture 的环境
    }

    const currentRect = sheetRef.current?.getBoundingClientRect();
    const currentH = currentRect ? currentRect.height : 440;

    startYRef.current = e.clientY;
    startHeightRef.current = currentH;
    isDraggingRef.current = true;
    hasMovedRef.current = false;
    lastDeltaYRef.current = 0;
    setIsDragging(true);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;

    const deltaY = startYRef.current - e.clientY; // 向上拖拽为正，向下拖拽为负
    lastDeltaYRef.current = deltaY;

    if (Math.abs(deltaY) > 5) {
      hasMovedRef.current = true;
    }

    const windowH = window.visualViewport?.height ?? window.innerHeight;

    if (deltaY <= 0) {
      // 下拉拖拽：纯 transform: translateY 驱动，绝不改动 height
      setTranslateY(-deltaY);
    } else {
      // 向上拖拽扩展：调节至目标高度
      const maxH = Math.round(windowH * 0.88);
      const proposedHeight = startHeightRef.current + deltaY;
      const clampedH = Math.min(maxH, proposedHeight);
      setSheetHeight(clampedH);
      setTranslateY(0);
    }
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    setIsDragging(false);

    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      // 忽略
    }

    const windowH = window.visualViewport?.height ?? window.innerHeight;
    const maxH = Math.round(windowH * 0.88);
    const minH = Math.min(320, Math.round(windowH * 0.45));

    // 如果只是点击/轻触（位移小于阈值），切换便携与大屏档位
    if (!hasMovedRef.current) {
      if (sheetHeight && sheetHeight > windowH * 0.7) {
        setSheetHeight(null);
      } else {
        setSheetHeight(maxH);
      }
      setTranslateY(0);
      return;
    }

    // 下拉幅度超过阈值，触发关闭
    if (translateY > 75 || lastDeltaYRef.current < -100) {
      onClose();
      return;
    }

    setTranslateY(0);

    // 智能档位吸附：偏上吸附至全屏 88vh，偏下吸附回便携档
    if (sheetHeight) {
      if (sheetHeight > windowH * 0.72) {
        setSheetHeight(maxH);
      } else if (sheetHeight < minH + 40) {
        setSheetHeight(null);
      }
    }
  };

  const backdropOpacity = translateY > 0 ? Math.max(0, 1 - translateY / 220) : 1;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end" role="dialog" aria-modal="true">
      {/* 遮罩背景 */}
      <div
        className="fixed inset-0 bg-black/45 backdrop-blur-[2px] transition-opacity duration-200"
        style={{ opacity: backdropOpacity }}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* 底部抽屉面板 */}
      <div
        ref={sheetRef}
        className="relative z-10 w-full max-w-lg mx-auto bg-[var(--color-surface)] rounded-t-2xl shadow-xl border-t border-[var(--color-border-light)] flex flex-col orbit-bottom-sheet-panel"
        style={{
          maxHeight,
          height: sheetHeight ? `${sheetHeight}px` : undefined,
          transform: translateY > 0 ? `translateY(${translateY}px)` : undefined,
          transition: isDragging
            ? "none"
            : "transform 0.25s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1))",
          paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)",
        }}
      >
        {/* 顶部拉手 */}
        <div
          role="slider"
          aria-label="调节面板大小"
          tabIndex={0}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onKeyDown={(e) => {
            const windowH = window.visualViewport?.height ?? window.innerHeight;
            if (e.key === "ArrowUp") {
              e.preventDefault();
              setSheetHeight(Math.round(windowH * 0.88));
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              setSheetHeight(null);
            }
          }}
          className="w-full flex items-center justify-center pt-2.5 pb-1.5 cursor-ns-resize touch-none select-none group"
        >
          <div
            className={`h-1 rounded-full transition-all duration-200 ${
              isDragging
                ? "w-12 bg-[var(--color-primary)] opacity-90 scale-y-125"
                : "w-10 bg-[var(--color-border)] opacity-80 group-hover:w-12 group-hover:opacity-100 group-hover:bg-[var(--color-border-dark)]"
            }`}
          />
        </div>

        {/* 标题栏 */}
        {(title || !hideCloseButton) && (
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            className="flex items-center justify-between px-4 py-2 border-b border-[var(--color-border-light)] touch-none select-none cursor-ns-resize"
          >
            <div className="font-heading font-medium text-[var(--color-text-primary)] text-base truncate pointer-events-none">
              {title}
            </div>
            {!hideCloseButton && (
              <button
                type="button"
                onClick={onClose}
                onPointerDown={(e) => e.stopPropagation()}
                aria-label="关闭"
                className="p-1.5 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-raised)] transition-colors cursor-pointer"
              >
                <CloseIcon size="sm" />
              </button>
            )}
          </div>
        )}

        {/* 抽屉内容主体 */}
        <div className="flex-1 overflow-y-auto px-4 py-3 overscroll-contain flex flex-col min-h-0">
          {children}
        </div>
      </div>
    </div>
  );
}
