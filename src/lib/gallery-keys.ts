const IMG_REF =
  /(?:\/assets\/|assets\/)([a-z0-9]{8}\.(?:jpg|jpeg|png|gif|webp|heic))/gi;

const THUMB_SUFFIX = ".w480.webp";

export function normalizeStorageKey(name: string): string {
  return name.toLowerCase().replace(/\.jpeg$/, ".jpg");
}

export function isThumbStorageKey(key: string): boolean {
  return key.toLowerCase().endsWith(THUMB_SUFFIX);
}

/** Content-addressed list thumb beside the original object; not an asset row. */
export function thumbStorageKey(originalKey: string): string {
  const normalized = normalizeStorageKey(originalKey);
  const hash = normalized.slice(0, 8);
  return `${hash}${THUMB_SUFFIX}`;
}

export function publicAssetUrl(storageKey: string): string {
  return `/assets/${normalizeStorageKey(storageKey)}`;
}

export function listImageUrl(
  storageKey: string,
  hasThumb: number | boolean | null | undefined
): string {
  if (Number(hasThumb) === 1) {
    return publicAssetUrl(thumbStorageKey(storageKey));
  }
  return publicAssetUrl(storageKey);
}

export function extractStorageKeysFromBody(body: string | null | undefined): string[] {
  if (!body) return [];
  const keys: string[] = [];
  let match: RegExpExecArray | null;
  const re = new RegExp(IMG_REF.source, "gi");
  while ((match = re.exec(body)) !== null) {
    keys.push(normalizeStorageKey(match[1]));
  }
  return keys;
}

export function isImageStorageKey(key: string): boolean {
  if (isThumbStorageKey(key)) return false;
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(key);
}

export function canMakeListThumb(mimeType: string): boolean {
  if (!mimeType.startsWith("image/")) return false;
  const mime = mimeType.toLowerCase();
  return mime !== "image/gif" && mime !== "image/svg+xml";
}

export function mimeTypeFromKey(key: string): string {
  const ext = key.includes(".") ? key.slice(key.lastIndexOf(".")).toLowerCase() : "";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  return "image/jpeg";
}
