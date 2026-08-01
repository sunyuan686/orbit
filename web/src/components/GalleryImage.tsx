import { useEffect, useRef, useState } from "react";
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

export function GalleryImage({
  src,
  blurhash,
  width,
  height,
  variant = "thumb",
}: GalleryImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loadState, setLoadState] = useState<LoadState>("loading");
  const placeholder = getMediaPlaceholderDataUrl(blurhash, width, height);

  useEffect(() => {
    setLoadState("loading");
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) {
      setLoadState("loaded");
    }
  }, [src]);

  const stackClass = `orbit-gallery-image-stack orbit-gallery-image-stack--${variant}`;

  return (
    <span className={stackClass}>
      {placeholder && (
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
        loading="lazy"
        decoding="async"
        className="orbit-gallery-image-img"
        data-loaded={loadState === "loaded" ? "true" : "false"}
        data-error={loadState === "error" ? "true" : "false"}
        onLoad={() => setLoadState("loaded")}
        onError={() => setLoadState("error")}
      />
    </span>
  );
}
