import { getEditScope, type EditScope } from "../specs/entry-types.js";
export type { EditScope };

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
