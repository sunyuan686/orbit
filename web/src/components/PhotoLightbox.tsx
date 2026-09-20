import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from "./OrbitIcons";
import { GalleryImage } from "./GalleryImage";

export interface LightboxPhoto {
  id: string | number;
  url: string;
  thumbUrl?: string;
  width?: number | null;
  height?: number | null;
  blurhash?: string | null;
  caption?: string | null;
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
  const [currentIndex, setCurrentIndex] = useState(() =>
    Math.max(0, Math.min(initialIndex, photos.length - 1))
  );
  const [showControls, setShowControls] = useState(true);
  const panelRef = useRef<HTMLDivElement>(null);
  const touchDeltaRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const controlsTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const currentPhoto = photos[currentIndex];
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex < photos.length - 1;

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

  // 控制栏定时自动淡出
  useEffect(() => {
    resetControlsTimer();
    return () => {
      if (controlsTimerRef.current) {
        clearTimeout(controlsTimerRef.current);
      }
    };
  }, [currentIndex, resetControlsTimer]);

  // 页面滚动锁（模态打开时禁止底层穿透滚动）
  useEffect(() => {
    const origOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = origOverflow;
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

  // 移动端触摸手势：横向轻扫切图、纵向阻尼下拉关闭
  const handleTouchStart = (e: React.TouchEvent) => {
    resetControlsTimer();
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    touchDeltaRef.current = { x: 0, y: 0 };
    if (panelRef.current) {
      panelRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;
    touchDeltaRef.current = { x: deltaX, y: deltaY };

    if (panelRef.current) {
      const translateY = deltaY > 0 ? deltaY : 0;
      const scale = deltaY > 0 ? Math.max(0.75, 1 - deltaY / 500) : 1;
      panelRef.current.style.transform = `translate3d(${deltaX}px, ${translateY}px, 0) scale(${scale})`;
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const { x: deltaX, y: deltaY } = touchDeltaRef.current;
    const duration = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    touchDeltaRef.current = { x: 0, y: 0 };

    const absX = Math.abs(deltaX);
    const absY = Math.abs(deltaY);

    // 下拉阻尼释放退出 (Pull down to dismiss)
    if (deltaY > 80 && absY > absX * 1.2) {
      if (panelRef.current) {
        panelRef.current.style.transition = "transform 0.2s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.2s ease";
        panelRef.current.style.transform = "translate3d(0, 100vh, 0) scale(0.75)";
        panelRef.current.style.opacity = "0";
      }
      setTimeout(onClose, 200);
      return;
    }

    // 横向滑动切换 (Horizontal swipe)
    if (absX > 45 || (absX > 20 && duration < 250)) {
      if (deltaX < 0 && hasNext) {
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
        }, 180);
        return;
      } else if (deltaX > 0 && hasPrev) {
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
        }, 180);
        return;
      }
    }

    // 未达阈值或处于边界：平滑弹回原位
    if (panelRef.current) {
      panelRef.current.style.transition = "transform 0.25s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.25s ease";
      panelRef.current.style.transform = "";
      panelRef.current.style.opacity = "";
    }
  };

  if (!currentPhoto) return null;

  const controlsClass = showControls
    ? "orbit-gallery-lightbox-controls"
    : "orbit-gallery-lightbox-controls orbit-gallery-lightbox-controls--hidden";

  return (
    <div
      className="orbit-gallery-lightbox"
      role="dialog"
      aria-modal="true"
      aria-label="照片大图预览"
      onClick={onClose}
    >
      {/* 序号计数气泡 */}
      {photos.length > 1 && (
        <div className={`orbit-gallery-lightbox-counter font-mono ${controlsClass}`}>
          {currentIndex + 1} / {photos.length}
        </div>
      )}

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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onClick={(e) => {
          e.stopPropagation();
          if (!showControls) {
            resetControlsTimer();
          } else {
            setShowControls(false);
          }
        }}
      >
        {/* 关闭按钮 */}
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

        {/* 高性能渐进加载大图 */}
        <GalleryImage
          src={currentPhoto.url}
          blurhash={currentPhoto.blurhash}
          width={currentPhoto.width}
          height={currentPhoto.height}
          variant="lightbox"
        />

        {/* 照片文字描述（如有） */}
        {currentPhoto.caption && (
          <div className="orbit-gallery-lightbox-meta border-t border-[var(--color-border-light)]">
            <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
              {currentPhoto.caption}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
