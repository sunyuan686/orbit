export const CANONICAL_AUTHORS = ["小圆子", "小麟子"] as const;
export type CanonicalAuthor = (typeof CANONICAL_AUTHORS)[number];

const AUTHOR_ALIASES: Record<string, CanonicalAuthor> = {
  小圆子: "小圆子",
  sunyuan: "小圆子",
  孙远: "小圆子",
  yuan: "小圆子",
  小麟子: "小麟子",
  linzhi: "小麟子",
  麟宝: "小麟子",
  辛麟芝: "小麟子",
  zhi: "小麟子",
};

export function normalizeAuthor(raw: string): string {
  const key = raw.trim();
  return AUTHOR_ALIASES[key] ?? key;
}

export function isCanonicalAuthor(value: string): value is CanonicalAuthor {
  return (CANONICAL_AUTHORS as readonly string[]).includes(value);
}

/** 新建用 session；更新时保留已有规范作者，否则用当前登录者 */
export function resolveAuthorForWrite(
  existing: string | null | undefined,
  sessionAuthor: CanonicalAuthor
): CanonicalAuthor {
  const normalized = existing ? normalizeAuthor(existing) : "";
  if (isCanonicalAuthor(normalized)) return normalized;
  return sessionAuthor;
}
