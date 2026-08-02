/**
 * Orbit 前端条目类型注册表 (Entry Type Registry)
 * 统一前端路由、类型判断、标签与视图策略的 SSOT
 */

export interface EntryTypeMeta {
  type: string;
  label: string;
  editScope: "author" | "couple";
  hasTitle: boolean;
  supportsViewSwitch: boolean;
  defaultViewMode: "classic" | "polaroid";
}

export const ENTRY_TYPES: Record<string, EntryTypeMeta> = {
  diary: {
    type: "diary",
    label: "日记",
    editScope: "author",
    hasTitle: true,
    supportsViewSwitch: true,
    defaultViewMode: "classic",
  },
  note: {
    type: "note",
    label: "随想",
    editScope: "author",
    hasTitle: false,
    supportsViewSwitch: false,
    defaultViewMode: "polaroid",
  },
  appreciation: {
    type: "appreciation",
    label: "感谢",
    editScope: "author",
    hasTitle: false,
    supportsViewSwitch: false,
    defaultViewMode: "polaroid",
  },
  timeline: {
    type: "timeline",
    label: "时间线",
    editScope: "author",
    hasTitle: true,
    supportsViewSwitch: true,
    defaultViewMode: "classic",
  },
  message: {
    type: "message",
    label: "留言板",
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
  memo: {
    type: "memo",
    label: "备忘录",
    editScope: "couple",
    hasTitle: true,
    supportsViewSwitch: false,
    defaultViewMode: "classic",
  },
};

export const ALL_ENTRY_TYPES = Object.keys(ENTRY_TYPES);

/** 用于时光流/首页 Feed 展示的条目类型（排除 memo） */
export const FEED_ENTRY_TYPES = ALL_ENTRY_TYPES.filter((t) => t !== "memo");

export function isValidEntryType(type: string): boolean {
  return type in ENTRY_TYPES;
}

export function resolveEntryType(type: string | undefined | null, fallback = "diary"): string {
  if (type && isValidEntryType(type)) return type;
  return fallback;
}

export function getEntryTypeLabel(type: string): string {
  return ENTRY_TYPES[type]?.label ?? type;
}

export function getEditScope(type: string): "author" | "couple" {
  return ENTRY_TYPES[type]?.editScope ?? "author";
}

/** 前端类型标签影射表 */
export const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  Object.entries(ENTRY_TYPES).map(([k, v]) => [k, v.label])
);
// 兼容旧路径
TYPE_LABEL.messages = TYPE_LABEL.message;
TYPE_LABEL.letters = TYPE_LABEL.letter;
