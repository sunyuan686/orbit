import type { AccentPreset } from "./api";

export interface AccentPresetMeta {
  id: AccentPreset;
  label: string;
}

export const ACCENT_PRESET_LIST: AccentPresetMeta[] = [
  { id: "stone", label: "石色" },
  { id: "rose", label: "暖玫" },
  { id: "sage", label: "青绿" },
  { id: "dusk", label: "暮蓝" },
];

export function applyAccentPreset(preset: AccentPreset): void {
  if (preset === "stone") {
    document.documentElement.removeAttribute("data-accent");
    return;
  }
  document.documentElement.dataset.accent = preset;
}
