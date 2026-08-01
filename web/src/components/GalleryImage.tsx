import { useLayoutEffect, useRef, useState } from "react";
import { getMediaPlaceholderDataUrl } from "../lib/blurhash-placeholder";

type GalleryImageVariant = "thumb" | "lightbox" | "home";

interface GalleryImageProps {
  src: string;
  blurhash?: string | null;
  width?: number | null;
  height?: number | null;
  variant?: GalleryImageVariant;
}

type LoadState = "loading" | "loaded" | "error";

/** Session cache: avoid blurhash flash when list items remount after refetch. */
const loadedSrcCache = new Set<string>();

function resolveLoadState(el: HTMLImageElement | null, src: string): LoadState {
  if (loadedSrcCache.has(src)) return "loaded";
  if (el?.complete && el.naturalWidth > 0) {
    loadedSrcCache.add(src);
    return "loaded";
  }
  return "loading";
}

export function GalleryImage({
  src,
  blurhash,
  width,
  height,
  variant = "thumb",
}: GalleryImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<LoadState>(() =>
    resolveLoadState(null, src)
  );
  const placeholder = getMediaPlaceholderDataUrl(blurhash, width, height);
  const showPlaceholder = placeholder && loadState !== "loaded";

  useLayoutEffect(() => {
    setLoadState(resolveLoadState(imgRef.current, src));
  }, [src]);

  const stackClass = `orbit-gallery-image-stack orbit-gallery-image-stack--${variant}`;
  const aspectRatio =
    width && height && width > 0 && height > 0 ? `${width} / ${height}` : undefined;

  return (
    <span
      className={stackClass}
      data-load-state={loadState}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      {showPlaceholder && (
        <span
          className="orbit-gallery-image-placeholder"
          style={{ backgroundImage: `url(${placeholder})` }}
          aria-hidden
        />
      )}
      <img
        ref={imgRef}
        src={src}
        alt=""
        loading={variant === "lightbox" ? "eager" : "lazy"}
        decoding="async"
        width={width ?? undefined}
        height={height ?? undefined}
        className="orbit-gallery-image-img"
        onLoad={() => {
          loadedSrcCache.add(src);
          setLoadState("loaded");
        }}
        onError={() => setLoadState("error")}
      />
    </span>
  );
}
