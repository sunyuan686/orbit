/** @deprecated 存量别名映射；新空间仅用于 migration 回填与导入兼容 */
export const LEGACY_CANONICAL_AUTHORS = ["小圆子", "小麟子"] as const;
export type LegacyCanonicalAuthor = (typeof LEGACY_CANONICAL_AUTHORS)[number];

const AUTHOR_ALIASES: Record<string, string> = {
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

export const AUTHOR_LABELS_FOR_YUAN = ["小圆子", "sunyuan", "孙远", "yuan"];
export const AUTHOR_LABELS_FOR_LIN = ["小麟子", "linzhi", "麟宝", "辛麟芝", "zhi"];

export function normalizeAuthor(raw: string): string {
  const key = raw.trim();
  return AUTHOR_ALIASES[key] ?? key;
}

/** @deprecated 仅存量兼容；新逻辑请用 userId */
export function isLegacyCanonicalAuthor(value: string): value is LegacyCanonicalAuthor {
  return (LEGACY_CANONICAL_AUTHORS as readonly string[]).includes(value);
}

// 兼容旧 import
export const CANONICAL_AUTHORS = LEGACY_CANONICAL_AUTHORS;
export type CanonicalAuthor = LegacyCanonicalAuthor;
export const isCanonicalAuthor = isLegacyCanonicalAuthor;
