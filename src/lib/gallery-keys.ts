const IMG_REF =
  /(?:\/assets\/|assets\/)([a-z0-9]{8}\.(?:jpg|jpeg|png|gif|webp|heic))/gi;

export function normalizeStorageKey(name: string): string {
  return name.toLowerCase().replace(/\.jpeg$/, ".jpg");
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
  return /\.(jpe?g|png|gif|webp|heic)$/i.test(key);
}

export function mimeTypeFromKey(key: string): string {
  const ext = key.includes(".") ? key.slice(key.lastIndexOf(".")).toLowerCase() : "";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".heic") return "image/heic";
  return "image/jpeg";
}
