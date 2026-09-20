/**
 * Orbit 条目类型注册表 (Entry Type Registry)
 * 遵守第一性原理：所有记录条目的元数据定义唯一的单一事实源 (SSOT)
 */

export type EditScope = "author" | "couple";

export interface EntryTypeMeta {
  type: string;
  label: string;
  editScope: EditScope;
  hasTitle: boolean;
  supportsViewSwitch: boolean;
  defaultViewMode: "classic" | "polaroid";
}

export const ENTRY_TYPES: Record<string, EntryTypeMeta> = {
  moment: {
    type: "moment",
    label: "动态",
    editScope: "author",
    hasTitle: false,
    supportsViewSwitch: true,
    defaultViewMode: "polaroid",
  },
  letter: {
    type: "letter",
    label: "信箱",
    editScope: "author",
    hasTitle: true,
    supportsViewSwitch: false,
    defaultViewMode: "classic",
  },
};

export const ALL_ENTRY_TYPES = Object.keys(ENTRY_TYPES);

/** 用于时光流/首页 Feed 展示的条目类型 */
export const FEED_ENTRY_TYPES = ALL_ENTRY_TYPES;

export function isValidEntryType(type: string): boolean {
  return type in ENTRY_TYPES;
}

export function resolveEntryType(type: string | undefined | null, fallback = "moment"): string {
  if (type && isValidEntryType(type)) return type;
  return fallback;
}

export function getEntryTypeLabel(type: string): string {
  return ENTRY_TYPES[type]?.label ?? "内容";
}

export function getEditScope(type: string): "author" | "couple" {
  return ENTRY_TYPES[type]?.editScope ?? "author";
}

/** 前端类型标签映射表（统一由 ENTRY_TYPES 派生） */
export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ENTRY_TYPES).map(([k, v]) => [k, v.label])
);
