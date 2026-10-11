export interface PresetAvatar {
  id: string;
  label: string;
  url: string;
}

export const PRESET_AVATARS: PresetAvatar[] = [
  { id: "felix", label: "晨曦", url: "/presets/avatars/felix.svg" },
  { id: "luna", label: "望舒", url: "/presets/avatars/luna.svg" },
  { id: "leo", label: "知微", url: "/presets/avatars/leo.svg" },
  { id: "mia", label: "清欢", url: "/presets/avatars/mia.svg" },
  { id: "oliver", label: "山川", url: "/presets/avatars/oliver.svg" },
  { id: "chloe", label: "星河", url: "/presets/avatars/chloe.svg" },
  { id: "ethan", label: "暖阳", url: "/presets/avatars/ethan.svg" },
  { id: "zoe", label: "微风", url: "/presets/avatars/zoe.svg" },
];

export function getDefaultAvatar(userId?: string | null): string {
  if (!userId) return PRESET_AVATARS[0].url;
  let hash = 0;
  for (let i = 0; i < userId.length; i++) {
    hash = (hash << 5) - hash + userId.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % PRESET_AVATARS.length;
  return PRESET_AVATARS[index].url;
}
