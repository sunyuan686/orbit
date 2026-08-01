import { useEffect, useRef, useState } from "react";
import { getMediaPlaceholderDataUrl } from "../lib/blurhash-placeholder";

interface GalleryImageProps {
  src: string;
  blurhash?: string | null;
  width?: number | null;
  height?: number | null;
  className?: string;
}

export function GalleryImage({
  src,
  blurhash,
  width,
  height,
  className,
}: GalleryImageProps) {
  const imgRef = useRef<HTMLImageElement>(null);
  const [loaded, setLoaded] = useState(false);
  const placeholder = getMediaPlaceholderDataUrl(blurhash, width, height);

  useEffect(() => {
    setLoaded(false);
    const el = imgRef.current;
    if (el?.complete && el.naturalWidth > 0) {
      setLoaded(true);
    }
  }, [src]);

  return (
    <img
      ref={imgRef}
      src={src}
      alt=""
      loading="lazy"
      decoding="async"
      className={className}
      data-loaded={loaded ? "true" : "false"}
      onLoad={() => setLoaded(true)}
      onError={() => setLoaded(true)}
      style={
        placeholder
          ? {
              backgroundImage: `url(${placeholder})`,
              backgroundSize: "cover",
              backgroundPosition: "center",
              backgroundRepeat: "no-repeat",
            }
          : undefined
      }
    />
  );
}
