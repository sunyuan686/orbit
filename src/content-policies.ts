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

export function canEditContent(
  contentType: string,
  ownerUserId: string | null | undefined,
  sessionUserId: string | null | undefined,
  spaceUserIds?: string[]
): boolean {
  if (!sessionUserId) return false;
  if (getEditScope(contentType) === "couple") {
    return spaceUserIds?.includes(sessionUserId) ?? true;
  }
  return Boolean(ownerUserId && ownerUserId === sessionUserId);
}

export function canDeleteContent(
  ownerUserId: string | null | undefined,
  sessionUserId: string | null | undefined
): boolean {
  if (!sessionUserId || !ownerUserId) return false;
  return ownerUserId === sessionUserId;
}
