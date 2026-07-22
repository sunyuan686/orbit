const SKIP_TYPES = new Set(["image/gif", "image/svg+xml"]);
const MAX_EDGE = 2048;
const QUALITY = 0.82;
/** 小于此体积不压，避免二次编码浪费 */
const SKIP_BELOW_BYTES = 400 * 1024;

/**
 * 上传前客户端压缩：等比缩到最长边 MAX_EDGE，输出 webp（失败回退 jpeg）。
 * GIF/SVG 原样返回；压完更大则保留原文件。
 */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || SKIP_TYPES.has(file.type)) {
    return file;
  }
  if (file.size <= SKIP_BELOW_BYTES) {
    return file;
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return file;
  }

  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);

    const blob =
      (await canvasToBlob(canvas, "image/webp", QUALITY)) ??
      (await canvasToBlob(canvas, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;

    const ext = blob.type === "image/webp" ? ".webp" : ".jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + ext;
    return new File([blob], name, {
      type: blob.type,
      lastModified: Date.now(),
    });
  } finally {
    bitmap.close();
  }
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number
): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob(resolve, type, quality);
  });
}
