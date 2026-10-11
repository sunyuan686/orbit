import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { getMediaPlaceholderDataUrl } from "../lib/blurhash-placeholder";

type GalleryImageVariant = "thumb" | "lightbox" | "home";

interface GalleryImageProps {
  src: string;
  thumbUrl?: string | null;
  blurhash?: string | null;
  width?: number | null;
  height?: number | null;
  variant?: GalleryImageVariant;
  className?: string;
  imgClassName?: string;
}

type LoadState = "loading" | "loaded" | "error";

/** Session cache: avoid blurhash flash when list items remount after refetch. */
const loadedSrcCache = new Set<string>();

export function isImageCached(src: string): boolean {
  return loadedSrcCache.has(src);
}

export function markImageCached(src: string): void {
  loadedSrcCache.add(src);
}

function resolveLoadState(el: HTMLImageElement | null, src: string): LoadState {
  if (isImageCached(src)) return "loaded";
  if (el?.complete && el.naturalWidth > 0) {
    markImageCached(src);
    return "loaded";
  }
  return "loading";
}

export function GalleryImage({
  src,
  thumbUrl,
  blurhash,
  width,
  height,
  variant = "thumb",
  className,
  imgClassName,
}: GalleryImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<LoadState>(() =>
    resolveLoadState(null, src)
  );
  const [aspectRatio, setAspectRatio] = useState<string | undefined>(() =>
    width && height && width > 0 && height > 0 ? `${width} / ${height}` : undefined
  );

  const placeholder = getMediaPlaceholderDataUrl(blurhash, width, height);
  const hasThumb = Boolean(thumbUrl && thumbUrl !== src);
  const hasPlaceholder = Boolean(placeholder) || hasThumb;
  // 若当前图片在会话缓存中已确认加载就绪，无需再挂载占位骨架，消除列表重建时的占位淡出闪烁
  const isCached = isImageCached(src);
  const showPlaceholder = hasPlaceholder && !isCached;

  useLayoutEffect(() => {
    setLoadState(resolveLoadState(imgRef.current, src));
  }, [src]);

  useEffect(() => {
    if (width && height && width > 0 && height > 0) {
      setAspectRatio(`${width} / ${height}`);
    }
  }, [width, height]);

  const handleDimensionDiscovered = (el: HTMLImageElement) => {
    if (!aspectRatio && el.naturalWidth > 0 && el.naturalHeight > 0) {
      setAspectRatio(`${el.naturalWidth} / ${el.naturalHeight}`);
    }
  };

  const stackClass = [
    `orbit-gallery-image-stack orbit-gallery-image-stack--${variant}`,
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <span
      className={stackClass}
      data-load-state={loadState}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {showPlaceholder && (
        <span className="orbit-gallery-image-placeholder" aria-hidden>
          {placeholder && (
            <span
              className="orbit-gallery-image-blurhash"
              style={{ backgroundImage: `url(${placeholder})` }}
            />
          )}
          {hasThumb && (
            <img
              src={thumbUrl!}
              alt=""
              decoding="async"
              className="orbit-gallery-image-thumb-placeholder"
              onLoad={(e) => handleDimensionDiscovered(e.currentTarget)}
            />
          )}
        </span>
      )}
      <img
        ref={imgRef}
        src={src}
        alt=""
        loading={isCached || variant === "lightbox" ? "eager" : "lazy"}
        decoding={isCached ? "sync" : "async"}
        width={width ?? undefined}
        height={height ?? undefined}
        className={["orbit-gallery-image-img", imgClassName].filter(Boolean).join(" ")}
        onLoad={(e) => {
          markImageCached(src);
          setLoadState("loaded");
          handleDimensionDiscovered(e.currentTarget);
        }}
        onError={() => setLoadState("error")}
      />
    </span>
  );
}
