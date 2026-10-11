import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  CloseIcon,
  LetterIcon,
  MomentIcon,
} from "./OrbitIcons";
import { GalleryImage } from "./GalleryImage";
import { formatDate, type GallerySource } from "../lib/api";

export interface LightboxPhoto {
  id: string | number;
  url: string;
  thumbUrl?: string;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  caption?: string | null;
  sources?: GallerySource[];
}

export interface PhotoLightboxProps {
  photos: LightboxPhoto[];
  initialIndex?: number;
  onClose: () => void;
  onIndexChange?: (index: number) => void;
}

export function PhotoLightbox({
  photos,
  initialIndex = 0,
  onClose,
  onIndexChange,
}: PhotoLightboxProps) {
  const navigate = useNavigate();
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, photos.length - 1))
  );
  const [showControls, setShowControls] = useState(true);

  const overlayRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);
  const isSwipingRef = useRef(false);
  const isTransitioningRef = useRef(false);
  const lastMouseMoveRef = useRef(0);

  const currentPhoto = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

  // 控制栏定时 2 秒自动淡出
  const resetControlsTimer = useCallback(() => {
    setShowControls(true);
    if (controlsTimerRef.current) {
      clearTimeout(controlsTimerRef.current);
    }
    controlsTimerRef.current = setTimeout(() => {
      setShowControls(false);
    }, 2000);
  }, []);

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const nextIdx = currentIndex - 1;
      setCurrentIndex(nextIdx);
      onIndexChange?.(nextIdx);
      resetControlsTimer();
    }
  }, [currentIndex, onIndexChange, resetControlsTimer]);

  const handleNext = useCallback(() => {
    if (currentIndex < photos.length - 1) {
      const nextIdx = currentIndex + 1;
      setCurrentIndex(nextIdx);
      onIndexChange?.(nextIdx);
      resetControlsTimer();
    }
  }, [currentIndex, photos.length, onIndexChange, resetControlsTimer]);

  // 切图与初始化时重置 2s 控制栏展示
  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [currentIndex, resetControlsTimer]);

  // 页面滚动锁（模态打开时挂起底层视口滚动，退出时完整复原）
  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("orbit-lightbox-active");
    return () => {
      root.classList.remove("orbit-lightbox-active");
    };
  }, []);

  // 预加载相邻的前后两张图片，保障秒切体验
  useEffect(() => {
    const prev = photos[currentIndex - 1];
    const next = photos[currentIndex + 1];
    if (prev?.url) {
      const img = new Image();
      img.src = prev.url;
    }
    if (next?.url) {
      const img = new Image();
      img.src = next.url;
    }
  }, [currentIndex, photos]);

  // 桌面端键盘按键监听：方向键切换与 Esc 退出
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      resetControlsTimer();
      if (e.key === "Escape") {
        onClose();
      } else if (e.key === "ArrowLeft") {
        handlePrev();
      } else if (e.key === "ArrowRight") {
        handleNext();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handlePrev, handleNext, onClose, resetControlsTimer]);

  // 桌面端鼠标移动平滑唤醒控制栏（节流防抖 200ms）
  const handleMouseMove = useCallback(() => {
    const now = Date.now();
    if (now - lastMouseMoveRef.current > 200) {
      lastMouseMoveRef.current = now;
      resetControlsTimer();
    }
  }, [resetControlsTimer]);

  // 触控手势处理：仅负责物理拖拽与滑动判定，不耦合点击与显隐状态
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1 || isTransitioningRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest("button, a")) {
      touchStartRef.current = null;
      return;
    }

    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };

    if (panelRef.current) {
      panelRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isTransitioningRef.current) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    if (panelRef.current) {
      const translateY = deltaY > 0 ? deltaY : 0;
      const scale = deltaY > 0 ? Math.max(0.75, 1 - deltaY / 500) : 1;
      panelRef.current.style.transform = `translate3d(${deltaX}px, ${translateY}px, 0) scale(${scale})`;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!touchStartRef.current || isTransitioningRef.current) return;

    let endX = touchStartRef.current.x;
    let endY = touchStartRef.current.y;
    if (e.changedTouches && e.changedTouches.length > 0) {
      endX = e.changedTouches[0].clientX;
      endY = e.changedTouches[0].clientY;
    }
    const deltaX = endX - touchStartRef.current.x;
    const deltaY = endY - touchStartRef.current.y;
    const duration = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 1. 下拉阻尼释放退出 (Pull down to dismiss)
    if (deltaY > 70 && absY > absX * 1.2) {
      isSwipingRef.current = true;
      setTimeout(() => {
        isSwipingRef.current = false;
      }, 400);
      if (panelRef.current) {
        panelRef.current.style.transition = "transform 0.2s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.2s ease";
        panelRef.current.style.transform = "translate3d(0, 100vh, 0) scale(0.75)";
        panelRef.current.style.opacity = "0";
      }
      setTimeout(onClose, 200);
      return;
    }

    // 2. 横向滑动切图 (Horizontal swipe to next / prev)
    const isHorizontalSwipe = (absX > 35 && absX > absY) || (absX > 20 && absX > absY && duration < 300);
    if (isHorizontalSwipe) {
      isSwipingRef.current = true;
      setTimeout(() => {
        isSwipingRef.current = false;
      }, 400);

      if (deltaX < 0 && hasNext) {
        isTransitioningRef.current = true;
        if (panelRef.current) {
          panelRef.current.style.transition = "transform 0.18s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.18s ease";
          panelRef.current.style.transform = "translate3d(-100vw, 0, 0)";
          panelRef.current.style.opacity = "0";
        }
        setTimeout(() => {
          handleNext();
          if (panelRef.current) {
            panelRef.current.style.transition = "none";
            panelRef.current.style.transform = "";
            panelRef.current.style.opacity = "";
          }
          isTransitioningRef.current = false;
        }, 180);
        return;
      } else if (deltaX > 0 && hasPrev) {
        isTransitioningRef.current = true;
        if (panelRef.current) {
          panelRef.current.style.transition = "transform 0.18s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.18s ease";
          panelRef.current.style.transform = "translate3d(100vw, 0, 0)";
          panelRef.current.style.opacity = "0";
        }
        setTimeout(() => {
          handlePrev();
          if (panelRef.current) {
            panelRef.current.style.transition = "none";
            panelRef.current.style.transform = "";
            panelRef.current.style.opacity = "";
          }
          isTransitioningRef.current = false;
        }, 180);
        return;
      }
    }

    // 3. 非滑动或未达阈值微小晃动：弹性复位卡片
    if (panelRef.current) {
      panelRef.current.style.transition = "transform 0.25s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.25s ease";
      panelRef.current.style.transform = "";
      panelRef.current.style.opacity = "";
    }
  };

  // 轻点交互统一状态机（全平台规范：桌面端鼠标点击与移动端触屏轻点）
  const handleOverlayClick = (e: React.MouseEvent) => {
    // 若刚刚执行了手势滑动（切图或下拉），拦截随后的合成 click 事件
    if (isSwipingRef.current) return;

    const target = e.target as HTMLElement;
    if (target.closest("button, a")) return;

    // 1. 点击图片卡片外部空白背景：一律直接关闭退出大图（符合 Modal 蒙层直觉，路径最短）
    if (!panelRef.current?.contains(target)) {
      onClose();
      return;
    }

    // 2. 点击图片卡片主体内部：切换控制栏显隐
    if (!showControls) {
      resetControlsTimer();
    } else {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
      setShowControls(false);
    }
  };

  if (!currentPhoto || typeof document === "undefined") return null;

  const controlsClass = showControls
    ? "orbit-gallery-lightbox-controls"
    : "orbit-gallery-lightbox-controls orbit-gallery-lightbox-controls--hidden";

  return createPortal(
    <div
      ref={overlayRef}
      className="orbit-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="照片大图预览"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={handleOverlayClick}
      onMouseMove={handleMouseMove}
    >
      {/* 序号计数气泡 - 位于视口左上角 */}
      {photos.length > 1 && (
        <div className={`orbit-gallery-lightbox-counter font-mono ${controlsClass}`}>
          {currentIndex + 1} / {photos.length}
        </div>
      )}

      {/* 关闭按钮 - 位于视口右上角，与左上角序号对齐，统一固定在全屏视口层 */}
      <button
        type="button"
        className={`orbit-gallery-lightbox-close orbit-icon-btn inline-flex items-center justify-center ${controlsClass}`}
        aria-label="关闭预览"
        onClick={(e) => {
          e.stopPropagation();
          onClose();
        }}
      >
        <CloseIcon size="sm" />
      </button>

      {/* 左侧上一张切换按钮 */}
      {hasPrev && (
        <button
          type="button"
          className={`orbit-gallery-lightbox-nav orbit-gallery-lightbox-nav--prev orbit-icon-btn ${controlsClass}`}
          aria-label="上一张图片"
          onClick={(e) => {
            e.stopPropagation();
            handlePrev();
          }}
        >
          <ChevronLeftIcon size="md" />
        </button>
      )}

      {/* 右侧下一张切换按钮 */}
      {hasNext && (
        <button
          type="button"
          className={`orbit-gallery-lightbox-nav orbit-gallery-lightbox-nav--next orbit-icon-btn ${controlsClass}`}
          aria-label="下一张图片"
          onClick={(e) => {
            e.stopPropagation();
            handleNext();
          }}
        >
          <ChevronRightIcon size="md" />
        </button>
      )}

      {/* 大图展示卡片（支持拖拽跟随与下拉缩放反馈） */}
      <div
        ref={panelRef}
        className="orbit-gallery-lightbox-panel"
      >
        {/* 高性能渐进加载大图 */}
        <GalleryImage
          src={currentPhoto.url}
          thumbUrl={currentPhoto.thumbUrl}
          blurhash={currentPhoto.blurhash}
          width={currentPhoto.width}
          height={currentPhoto.height}
          variant="lightbox"
        />

        {/* 照片文字描述与关联来源（如有） */}
        {(Boolean(currentPhoto.caption) || Boolean(currentPhoto.sources && currentPhoto.sources.length > 0)) && (
          <div className="orbit-gallery-lightbox-meta border-t border-[var(--color-border-light)]">
            {currentPhoto.caption && (
              <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed mb-2.5">
                {currentPhoto.caption}
              </p>
            )}

            {currentPhoto.sources && currentPhoto.sources.length > 0 && (
              <div className="orbit-gallery-lightbox-sources flex flex-wrap items-center gap-2">
                {currentPhoto.sources.map((source) => {
                  const isMoment = source.type === "moment";
                  const isLetter = source.type === "letter";
                  const typeLabel = isMoment ? "动态" : isLetter ? "信箱" : "关联";
                  const title = source.title?.trim();
                  const dateStr = source.entryDate ? formatDate(source.entryDate) : null;
                  const displayLabel = title || dateStr || typeLabel;
                  const href = `/${source.type}/${source.id}`;

                  return (
                    <button
                      key={`${source.type}:${source.id}`}
                      type="button"
                      className="orbit-gallery-source-tag group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-[var(--color-surface-raised)] hover:bg-[var(--color-bg)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors cursor-pointer"
                      title={`查看关联${typeLabel}：${displayLabel}`}
                      onTouchStart={(e) => {
                        e.stopPropagation();
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (e.metaKey || e.ctrlKey) {
                          window.open(href, "_blank");
                          return;
                        }
                        // 层内跳页面：遵循导航分层规范（Navigation Layers 规则 4）
                        // 用 replace 把层条目就地替换为目的页面条目，避免返回时复现浮层。
                        // 严禁在此处调用 onClose()（内部为异步 navigate(-1)），否则两次导航竞争会导致跳转被回退撤销。
                        navigate(href, { replace: true });
                      }}
                    >
                      <span className="text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)] transition-colors">
                        {isMoment ? <MomentIcon size="sm" /> : isLetter ? <LetterIcon size="sm" /> : null}
                      </span>
                      <span className="font-medium text-[var(--color-text-muted)] group-hover:text-[var(--color-text-secondary)]">
                        {typeLabel}
                      </span>
                      <span className="text-[var(--color-text-muted)]/60">·</span>
                      <span className="truncate max-w-[220px] font-mono text-[var(--color-text-secondary)] group-hover:text-[var(--color-text-primary)]">
                        {displayLabel}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
