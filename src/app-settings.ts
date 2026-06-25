export const APP_SETTING_KEYS = {
  accentPreset: "accent_preset",
} as const;

export const ACCENT_PRESETS = ["stone", "rose", "sage", "dusk"] as const;
export type AccentPreset = (typeof ACCENT_PRESETS)[number];

export interface AppSettings {
  accentPreset: AccentPreset;
}

const DEFAULT_ACCENT_PRESET: AccentPreset = "stone";

export function isAccentPreset(value: string): value is AccentPreset {
  return (ACCENT_PRESETS as readonly string[]).includes(value);
}

export function buildAppSettings(
  settingsMap: Record<string, string>
): AppSettings {
  const raw = settingsMap[APP_SETTING_KEYS.accentPreset]?.trim();
  const accentPreset =
    raw && isAccentPreset(raw) ? raw : DEFAULT_ACCENT_PRESET;
  return { accentPreset };
}
