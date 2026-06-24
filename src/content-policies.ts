import { isCanonicalAuthor, normalizeAuthor } from "./authors.js";

/** Who may edit: sole author, or both accounts in the couple space */
export type EditScope = "author" | "couple";

export type ContentType = "diary" | "timeline" | "message" | "letter" | "memo";

const editScopeByType: Record<string, EditScope> = {
  diary: "author",
  timeline: "author",
  message: "author",
  letter: "author",
  memo: "couple",
};

export function getEditScope(contentType: string): EditScope {
  return editScopeByType[contentType] ?? "author";
}

function isContentAuthor(
  author: string | null | undefined,
  sessionAuthor: string
): boolean {
  const normalized = author ? normalizeAuthor(author) : "";
  if (!isCanonicalAuthor(normalized)) return false;
  return normalized === sessionAuthor;
}

/**
 * Whether the logged-in user may edit this content.
 * couple scope: any canonical author in the space; author scope: creator only.
 */
export function canEditContent(
  contentType: string,
  author: string | null | undefined,
  sessionAuthor: string | null | undefined
): boolean {
  if (!sessionAuthor || !isCanonicalAuthor(sessionAuthor)) return false;
  if (getEditScope(contentType) === "couple") return true;
  return isContentAuthor(author, sessionAuthor);
}

/** Delete remains creator-only for all content types */
export function canDeleteContent(
  author: string | null | undefined,
  sessionAuthor: string | null | undefined
): boolean {
  if (!sessionAuthor || !isCanonicalAuthor(sessionAuthor)) return false;
  return isContentAuthor(author, sessionAuthor);
}
