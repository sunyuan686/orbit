export type AccentTheme = "sage" | "amber" | "rose" | "indigo" | "cola" | "stone" | "dusk";
export type CanvasBg = "moonstone" | "studio" | "mist" | "warm-linen";
export type FontMode = "editorial" | "sans" | "handwriting";
export type ReadingFontSize = "normal" | "medium" | "large";

export interface AccentPresetMeta {
  id: AccentTheme;
  label: string;
  subLabel: string;
  colorPreview: string;
}

export interface CanvasBgMeta {
  id: CanvasBg;
  label: string;
  desc: string;
  colorPreview: string;
}

export interface FontModeMeta {
  id: FontMode;
  label: string;
  subLabel: string;
  desc: string;
}

export interface FontSizeMeta {
  id: ReadingFontSize;
  label: string;
  desc: string;
}

export const ACCENT_PRESET_LIST: AccentPresetMeta[] = [
  {
    id: "sage",
    label: "鼠尾草绿",
    subLabel: "推荐",
    colorPreview: "oklch(0.48 0.095 150)",
  },
  {
    id: "amber",
    label: "暖琥珀",
    subLabel: "暖光",
    colorPreview: "oklch(0.58 0.16 65)",
  },
  {
    id: "rose",
    label: "玫瑰粉",
    subLabel: "浪漫",
    colorPreview: "oklch(0.50 0.11 18)",
  },
  {
    id: "indigo",
    label: "深海靛",
    subLabel: "沉静",
    colorPreview: "oklch(0.48 0.095 250)",
  },
  {
    id: "cola",
    label: "可乐橙",
    subLabel: "明朗",
    colorPreview: "#f1752d",
  },
];

export const CANVAS_BG_LIST: CanvasBgMeta[] = [
  {
    id: "moonstone",
    label: "月石清白",
    desc: "纯净通透，默认推荐",
    colorPreview: "oklch(0.985 0.002 250)",
  },
  {
    id: "studio",
    label: "画廊冷灰",
    desc: "现代冷调，专注阅读",
    colorPreview: "#f4f4f6",
  },
  {
    id: "mist",
    label: "冷杉薄雾",
    desc: "微冷杉绿，护眼清爽",
    colorPreview: "oklch(0.985 0.004 165)",
  },
  {
    id: "warm-linen",
    label: "暖石燕麦",
    desc: "暖羊绒纸，怀旧复古",
    colorPreview: "oklch(0.982 0.008 75)",
  },
];

export const FONT_MODE_LIST: FontModeMeta[] = [
  {
    id: "editorial",
    label: "刊物文学",
    subLabel: "推荐",
    desc: "宋体标题 + 黑体正文",
  },
  {
    id: "sans",
    label: "现代极简",
    subLabel: "清爽",
    desc: "全站统一无衬线黑体",
  },
  {
    id: "handwriting",
    label: "温情手书",
    subLabel: "书信",
    desc: "宋体标题 + 楷体正文",
  },
];

export const FONT_SIZE_LIST: FontSizeMeta[] = [
  { id: "normal", label: "标准", desc: "15px" },
  { id: "medium", label: "适中", desc: "16px · 推荐" },
  { id: "large", label: "大号", desc: "17.5px" },
];

export const GRAIN_PRESETS = [
  { val: 0, label: "关闭" },
  { val: 0.025, label: "极微 (2.5%)" },
  { val: 0.05, label: "推荐 (5.0%)" },
  { val: 0.08, label: "复古 (8.0%)" },
];

const STORAGE_ACCENT_KEY = "orbit-accent-theme";
const STORAGE_BG_KEY = "orbit-canvas-bg";
const STORAGE_GRAIN_KEY = "orbit-grain-opacity";
const STORAGE_FONT_MODE_KEY = "orbit-font-mode";
const STORAGE_FONT_SIZE_KEY = "orbit-font-size";

export function getSavedAccentTheme(): AccentTheme {
  const saved = localStorage.getItem(STORAGE_ACCENT_KEY) as AccentTheme | null;
  if (saved === "dusk") return "indigo";
  if (saved === "stone") return "amber";
  return saved || "sage";
}

export function getSavedCanvasBg(): CanvasBg {
  const saved = localStorage.getItem(STORAGE_BG_KEY) as CanvasBg | null;
  return saved || "moonstone";
}

export function getSavedGrainOpacity(): number {
  const saved = localStorage.getItem(STORAGE_GRAIN_KEY);
  if (saved !== null) {
    const num = parseFloat(saved);
    if (!isNaN(num)) return num;
  }
  return 0.05;
}

export function getSavedFontMode(): FontMode {
  const saved = localStorage.getItem(STORAGE_FONT_MODE_KEY) as FontMode | null;
  if (saved === "sans" || saved === "handwriting" || saved === "editorial") return saved;
  return "editorial";
}

export function getSavedFontSize(): ReadingFontSize {
  const saved = localStorage.getItem(STORAGE_FONT_SIZE_KEY) as ReadingFontSize | null;
  if (saved === "normal" || saved === "medium" || saved === "large") return saved;
  return "medium";
}

export function applyAccentPreset(preset: AccentTheme): void {
  const normalized = preset === "dusk" ? "indigo" : preset === "stone" ? "amber" : preset;
  document.documentElement.dataset.accent = normalized;
  localStorage.setItem(STORAGE_ACCENT_KEY, normalized);
}

export function applyCanvasBg(bg: CanvasBg): void {
  document.documentElement.dataset.bg = bg;
  localStorage.setItem(STORAGE_BG_KEY, bg);
}

export function applyGrainOpacity(opacity: number): void {
  document.documentElement.style.setProperty("--grain-opacity", String(opacity));
  localStorage.setItem(STORAGE_GRAIN_KEY, String(opacity));
}

export function applyFontMode(mode: FontMode): void {
  document.documentElement.dataset.fontMode = mode;
  localStorage.setItem(STORAGE_FONT_MODE_KEY, mode);
}

export function applyReadingFontSize(size: ReadingFontSize): void {
  document.documentElement.dataset.fontSize = size;
  localStorage.setItem(STORAGE_FONT_SIZE_KEY, size);
}

export function initAppearancePreferences(): void {
  applyAccentPreset(getSavedAccentTheme());
  applyCanvasBg(getSavedCanvasBg());
  applyGrainOpacity(getSavedGrainOpacity());
  applyFontMode(getSavedFontMode());
  applyReadingFontSize(getSavedFontSize());
}
