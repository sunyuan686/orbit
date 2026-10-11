import React, { useState, useRef } from "react";
import { NodeViewWrapper, type NodeViewProps } from "@tiptap/react";
import { openMultiImageLightbox, type LightboxImageItem } from "../lib/lightbox";
import { isImageCached, markImageCached } from "./GalleryImage";
import { GalleryIcon, ChevronLeftIcon, ChevronRightIcon } from "./OrbitIcons";

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
  const frontCardRef = useRef<HTMLDivElement>(null);
  const touchDeltaXRef = useRef(0);
  const touchStartRef = useRef<{ x: number; y: number; time: number } | null>(null);

  const total = images?.length ?? 0;
  const currentImage = images?.[currentIndex];

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (total <= 0) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : total - 1));
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (total <= 0) return;
    setCurrentIndex((prev) => (prev < total - 1 ? prev + 1 : 0));
  };

  if (!images || images.length === 0 || !currentImage) return null;

  const handleImageClick = () => {
    // If was dragging/swiping, don't trigger click
    if (Math.abs(touchDeltaXRef.current) > 10) return;
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
    touchDeltaXRef.current = 0;
    if (frontCardRef.current) {
      frontCardRef.current.style.transition = "none";
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!touchStartRef.current || e.touches.length !== 1) return;
    const deltaX = e.touches[0].clientX - touchStartRef.current.x;
    const deltaY = e.touches[0].clientY - touchStartRef.current.y;

    // If scrolling vertically, let native scroll happen
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaX) < 10) {
      return;
    }

    const appliedX = deltaX * 0.75;
    touchDeltaXRef.current = appliedX;
    if (frontCardRef.current) {
      frontCardRef.current.style.transform = `translateX(${appliedX}px) rotate(${appliedX * 0.04}deg)`;
    }
  };

  const handleTouchEnd = () => {
    if (!touchStartRef.current) return;
    const duration = Date.now() - touchStartRef.current.time;
    touchStartRef.current = null;

    const appliedX = touchDeltaXRef.current;
    const absX = Math.abs(appliedX);
    touchDeltaXRef.current = 0;

    if (total > 1 && (absX > 40 || (absX > 20 && duration < 250))) {
      if (appliedX < 0) {
        if (frontCardRef.current) {
          frontCardRef.current.style.transition = "transform 0.18s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.18s ease";
          frontCardRef.current.style.transform = "translateX(-120%) rotate(-8deg)";
          frontCardRef.current.style.opacity = "0";
        }
        setTimeout(() => {
          handleNext();
          if (frontCardRef.current) {
            frontCardRef.current.style.transition = "none";
            frontCardRef.current.style.transform = "";
            frontCardRef.current.style.opacity = "";
          }
        }, 180);
        return;
      } else {
        if (frontCardRef.current) {
          frontCardRef.current.style.transition = "transform 0.18s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.18s ease";
          frontCardRef.current.style.transform = "translateX(120%) rotate(8deg)";
          frontCardRef.current.style.opacity = "0";
        }
        setTimeout(() => {
          handlePrev();
          if (frontCardRef.current) {
            frontCardRef.current.style.transition = "none";
            frontCardRef.current.style.transform = "";
            frontCardRef.current.style.opacity = "";
          }
        }, 180);
        return;
      }
    }

    if (frontCardRef.current) {
      frontCardRef.current.style.transition = "transform 0.22s var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1)), opacity 0.22s ease";
      frontCardRef.current.style.transform = "";
      frontCardRef.current.style.opacity = "";
    }
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
                loading={isImageCached(nextItem2.src) ? "eager" : "lazy"}
                decoding={isImageCached(nextItem2.src) ? "sync" : "async"}
                onLoad={() => markImageCached(nextItem2.src)}
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
                loading={isImageCached(nextItem1.src) ? "eager" : "lazy"}
                decoding={isImageCached(nextItem1.src) ? "sync" : "async"}
                onLoad={() => markImageCached(nextItem1.src)}
              />
            )}
          </div>
        )}

        {/* Layer 0: Front active card */}
        <div
          ref={frontCardRef}
          className="orbit-image-deck-card orbit-image-deck-card--front group cursor-pointer"
          onClick={handleImageClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <img
            src={currentImage.src}
            alt={currentImage.alt || currentImage.caption || `图片 ${currentIndex + 1}`}
            className="orbit-image-deck-img"
            loading={isImageCached(currentImage.src) ? "eager" : "lazy"}
            decoding={isImageCached(currentImage.src) ? "sync" : "async"}
            onLoad={() => markImageCached(currentImage.src)}
          />

          {/* Top Badge: Photo count pill */}
          <div className="orbit-image-deck-badge">
            <GalleryIcon className="w-3 h-3 text-white/90 mr-1" />
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
              <ChevronLeftIcon size="sm" />
            </button>
            <button
              type="button"
              className="orbit-image-deck-nav-btn orbit-image-deck-nav-btn--next"
              onClick={handleNext}
              title="下一张"
              aria-label="下一张图片"
            >
              <ChevronRightIcon size="sm" />
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

