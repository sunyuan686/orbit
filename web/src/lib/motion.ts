/** Matches `--motion-slow` in web/src/index.css */
export const MOTION_SLOW_MS = 220;

export function scrollBehavior(): ScrollBehavior {
  if (typeof window === "undefined") return "auto";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
