import { CANONICAL_AUTHORS, type CanonicalAuthor } from "./authors";

export type EditScope = "author" | "couple";

const editScopeByType: Record<string, EditScope> = {
  diary: "author",
  timeline: "author",
  message: "author",
  letter: "author",
  memo: "couple",
};

function isCanonical(sessionAuthor: string | null | undefined): sessionAuthor is CanonicalAuthor {
  return (
    !!sessionAuthor &&
    CANONICAL_AUTHORS.includes(sessionAuthor as CanonicalAuthor)
  );
}

function isContentAuthor(
  author: string | null | undefined,
  sessionAuthor: CanonicalAuthor
): boolean {
  return !!author && author === sessionAuthor;
}

export function canEditContent(
  contentType: string,
  author: string | null | undefined,
  sessionAuthor: string | null | undefined
): boolean {
  if (!isCanonical(sessionAuthor)) return false;
  if (editScopeByType[contentType] === "couple") return true;
  return isContentAuthor(author, sessionAuthor);
}

export function canDeleteContent(
  author: string | null | undefined,
  sessionAuthor: string | null | undefined
): boolean {
  if (!isCanonical(sessionAuthor)) return false;
  return isContentAuthor(author, sessionAuthor);
}
