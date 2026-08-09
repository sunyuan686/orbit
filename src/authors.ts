export const LEGACY_CANONICAL_AUTHORS = ["User A", "User B"] as const;
export type LegacyCanonicalAuthor = (typeof LEGACY_CANONICAL_AUTHORS)[number];

const AUTHOR_ALIASES: Record<string, string> = {
  "User A": "User A",
  "User B": "User B",
};

export function normalizeAuthor(raw: string): string {
  const key = raw.trim();
  return AUTHOR_ALIASES[key] ?? key;
}

export function isLegacyCanonicalAuthor(value: string): value is LegacyCanonicalAuthor {
  return (LEGACY_CANONICAL_AUTHORS as readonly string[]).includes(value as LegacyCanonicalAuthor);
}

export const CANONICAL_AUTHORS = LEGACY_CANONICAL_AUTHORS;
export type CanonicalAuthor = LegacyCanonicalAuthor;
export const isCanonicalAuthor = isLegacyCanonicalAuthor;
