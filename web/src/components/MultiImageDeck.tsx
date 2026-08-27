import React, { useState, useRef, useCallback } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { openMultiImageLightbox, type LightboxImageItem } from "../lib/lightbox";

export interface MultiImageDeckItem extends LightboxImageItem {
  src: string;
  alt?: string;
  caption?: string;
  title?: string;
}

export interface MultiImageDeckProps {
  images: MultiImageDeckItem[];
  initialIndex?: number;
  className?: string;
  onOpenLightbox?: (index: number) => void;
}

export function MultiImageDeck({
  images,
  initialIndex = 0,
  className = "",
  onOpenLightbox,
}: MultiImageDeckProps) {
  const [currentIndex, setCurrentIndex] = useState(
    Math.max(0, Math.min(initialIndex, images.length - 1))
  );
  const [touchDeltaX, setTouchDeltaX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  if (!images || images.length === 0) return null;

  const total = images.length;
  const currentImage = images[currentIndex];

  const handlePrev = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
    },
    [total]
  );

  const handleNext = useCallback(
    (e?: React.MouseEvent) => {
      e?.stopPropagation();
      setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
    },
    [total]
  );

  const handleImageClick = () => {
    // If was dragging/swiping, don't trigger click
    if (Math.abs(touchDeltaX) > 10) return;
    if (onOpenLightbox) {
      onOpenLightbox(currentIndex);
    } else {
      openMultiImageLightbox({
        images,
        initialIndex: currentIndex,
        onIndexChange: (idx) => setCurrentIndex(idx),
      });
    }
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length !== 1) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now(),
    };
    setIsSwiping(true);
    setTouchDeltaX(0);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    // If scrolling vertically, let native scroll happen
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 10) {
      return;
    }

    setTouchDeltaX(deltaX * 0.75);
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const duration = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;
    setIsSwiping(false);

    const absX = Math.abs(touchDeltaX);
    if (absX > 40 || (absX > 20 && duration < 250)) {
      if (touchDeltaX < 0) {
        handleNext();
      } else {
        handlePrev();
      }
    }
    setTouchDeltaX(0);
  };

  // Stacked background cards info (next 1~2 items)
  const nextItem1 = images[(currentIndex + 1) % total];
  const nextItem2 = images[(currentIndex + 2) % total];

  return (
    <div
      className={`orbit-image-deck-container my-4 select-none ${className}`}
      data-count={total}
    >
      <div className="orbit-image-deck-wrapper relative mx-auto w-full max-w-lg aspect-[4/3] max-h-[340px]">
        {/* Layer 2: Deepest background card (tilt 2deg) */}
        {total >= 3 && (
          <div
            className="orbit-image-deck-card orbit-image-deck-card--deep"
            aria-hidden="true"
          >
            {nextItem2 && (
              <img
                src={nextItem2.src}
                alt=""
                className="w-full h-full object-cover rounded-xl opacity-60"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Layer 1: Mid background card (tilt -2deg) */}
        {total >= 2 && (
          <div
            className="orbit-image-deck-card orbit-image-deck-card--mid"
            aria-hidden="true"
          >
            {nextItem1 && (
              <img
                src={nextItem1.src}
                alt=""
                className="w-full h-full object-cover rounded-xl opacity-75"
                loading="lazy"
              />
            )}
          </div>
        )}

        {/* Layer 0: Front active card */}
        <div
          className="orbit-image-deck-card orbit-image-deck-card--front group cursor-pointer"
          onClick={handleImageClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          style={{
            transform: touchDeltaX
              ? `translateX(${touchDeltaX}px) rotate(${touchDeltaX * 0.04}deg)`
              : undefined,
            transition: isSwiping ? "none" : "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
          }}
        >
          <img
            src={currentImage.src}
            alt={currentImage.alt || currentImage.caption || `图片 ${currentIndex + 1}`}
            className="orbit-image-deck-img"
            loading="lazy"
            decoding="async"
          />

          {/* Top Badge: Photo count pill */}
          <div className="orbit-image-deck-badge">
            <svg
              className="w-3 h-3 text-white/90 mr-1"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
              <circle cx="8.5" cy="8.5" r="1.5" />
              <polyline points="21 15 16 10 5 21" />
            </svg>
            <span>
              {currentIndex + 1} / {total}
            </span>
          </div>

          {/* Desktop Hover Nav Arrows */}
          <div className="orbit-image-deck-nav-overlay hidden sm:flex">
            <button
              type="button"
              className="orbit-image-deck-nav-btn orbit-image-deck-nav-btn--prev"
              onClick={handlePrev}
              title="上一张"
              aria-label="上一张图片"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              type="button"
              className="orbit-image-deck-nav-btn orbit-image-deck-nav-btn--next"
              onClick={handleNext}
              title="下一张"
              aria-label="下一张图片"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>

          {/* Caption if available */}
          {currentImage.caption && (
            <div className="orbit-image-deck-caption">
              <span className="truncate">{currentImage.caption}</span>
            </div>
          )}
        </div>

        {/* Bottom Pagination Dots */}
        {total > 1 && (
          <div className="orbit-image-deck-dots">
            {images.map((_, idx) => (
              <button
                key={idx}
                type="button"
                className={`orbit-image-deck-dot ${
                  idx === currentIndex ? "is-active" : ""
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  setCurrentIndex(idx);
                }}
                title={`跳转到第 ${idx + 1} 张`}
                aria-label={`跳转到第 ${idx + 1} 张`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function MultiImageDeckNodeView({ node, selected }: NodeViewProps) {
  const images = (node.attrs.images || []) as MultiImageDeckItem[];
  return (
    <NodeViewWrapper
      className={`tiptap-image-deck-node ${selected ? "ProseMirror-selectednode" : ""}`}
      data-is-deck="true"
    >
      <MultiImageDeck images={images} />
    </NodeViewWrapper>
  );
}

