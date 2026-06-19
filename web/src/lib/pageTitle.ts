export const SITE_NAME = "Orbit";

export function setPageTitle(...parts: (string | null | undefined)[]) {
  const segments = parts.filter((part): part is string => Boolean(part?.trim()));
  document.title = segments.length
    ? `${segments.join(" · ")} · ${SITE_NAME}`
    : SITE_NAME;
}
