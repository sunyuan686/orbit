import { useEffect, useState } from "react";

const XL_MEDIA = "(min-width: 1280px)";

export function useMinWidthXl(): boolean {
  const [matches, setMatches] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia(XL_MEDIA).matches;
  });

  useEffect(() => {
    const media = window.matchMedia(XL_MEDIA);
    const onChange = () => setMatches(media.matches);
    onChange();
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, []);

  return matches;
}
