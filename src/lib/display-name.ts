const DISPLAY_NAME_MAX = 16;
const DISPLAY_NAME_MIN = 1;
const CONTROL_CHARS = /[\u0000-\u001F\u007F]/;

export function normalizeDisplayName(raw: string): string {
  return raw.trim();
}

export function validateDisplayName(
  raw: string,
  options?: { otherNames?: string[] }
): { ok: true; name: string } | { ok: false; error: string } {
  const name = normalizeDisplayName(raw);
  if (name.length < DISPLAY_NAME_MIN) {
    return { ok: false, error: "爱称不能为空" };
  }
  if (name.length > DISPLAY_NAME_MAX) {
    return { ok: false, error: `爱称不能超过 ${DISPLAY_NAME_MAX} 个字符` };
  }
  if (CONTROL_CHARS.test(name)) {
    return { ok: false, error: "爱称包含无效字符" };
  }
  const others = options?.otherNames ?? [];
  if (others.some((other) => normalizeDisplayName(other) === name)) {
    return { ok: false, error: "该爱称已被另一位使用" };
  }
  return { ok: true, name };
}
