export type EditScope = "author" | "couple";

const editScopeByType: Record<string, EditScope> = {
  diary: "author",
  timeline: "author",
  message: "author",
  letter: "author",
  memo: "couple",
};

export function canEditContent(
  contentType: string,
  ownerUserId: string | null | undefined,
  sessionUserId: string | null | undefined
): boolean {
  if (!sessionUserId) return false;
  if (editScopeByType[contentType] === "couple") return true;
  return Boolean(ownerUserId && ownerUserId === sessionUserId);
}

export function canDeleteContent(
  ownerUserId: string | null | undefined,
  sessionUserId: string | null | undefined
): boolean {
  if (!sessionUserId || !ownerUserId) return false;
  return ownerUserId === sessionUserId;
}
