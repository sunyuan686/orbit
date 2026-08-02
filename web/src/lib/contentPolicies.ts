import { getEditScope } from "./entry-types";

export type EditScope = "author" | "couple";

export function canEditContent(
  contentType: string,
  ownerUserId: string | null | undefined,
  sessionUserId: string | null | undefined
): boolean {
  if (!sessionUserId) return false;
  if (getEditScope(contentType) === "couple") return true;
  return Boolean(ownerUserId && ownerUserId === sessionUserId);
}

export function canDeleteContent(
  ownerUserId: string | null | undefined,
  sessionUserId: string | null | undefined
): boolean {
  if (!sessionUserId || !ownerUserId) return false;
  return ownerUserId === sessionUserId;
}
