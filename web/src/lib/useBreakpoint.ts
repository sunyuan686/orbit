import { useEffect, useState } from "react";

const XL_MEDIA = "(min-width: 1280px)";
const MD_MAX_MEDIA = "(max-width: 767px)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(query);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [query]);

  return matches;
}

export function useMaxWidthMd(): boolean {
  return useMediaQuery(MD_MAX_MEDIA);
}

export function useMinWidthXl(): boolean {
  return useMediaQuery(XL_MEDIA);
}
