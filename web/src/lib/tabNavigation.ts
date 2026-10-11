export type TabKey = "moment" | "albums" | "letter" | "us";

export function getActiveTabKey(pathname: string): TabKey | null {
  if (pathname === "/" || pathname === "/moment") return "moment";
  if (pathname === "/albums" || pathname === "/gallery") return "albums";
  if (pathname === "/letter") return "letter";
  if (pathname === "/us" || pathname === "/space" || pathname === "/memo") return "us";
  return null;
}

export function isTabRoute(pathname: string): boolean {
  return getActiveTabKey(pathname) !== null;
}
