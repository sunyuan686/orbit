/**
 * Client-side image metadata for upload (blurhash + dimensions).
 * Mirrors jant media-metadata: Canvas + blurhash, no server sharp.
 */
import { encode } from "blurhash";

export interface ImageUploadMetadata {
  width: number;
  height: number;
  blurhash: string;
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Failed to load image"));
    };
    img.src = url;
  });
}

/**
 * Extract dimensions and blurhash from an image file (max 32px canvas).
 */
export async function extractImageMetadata(file: File): Promise<ImageUploadMetadata> {
  const img = await loadImage(file);
  const { width, height } = img;

  const scale = Math.min(32 / width, 32 / height, 1);
  const bw = Math.max(Math.round(width * scale), 1);
  const bh = Math.max(Math.round(height * scale), 1);

  const canvas = document.createElement("canvas");
  canvas.width = bw;
  canvas.height = bh;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Failed to get canvas context");
  ctx.drawImage(img, 0, 0, bw, bh);

  const imageData = ctx.getImageData(0, 0, bw, bh);
  const blurhash = encode(imageData.data, bw, bh, 4, 3);

  return { width, height, blurhash };
}

/**
 * Best-effort metadata for uploads; returns undefined when extraction fails.
 */
export async function extractImageMetadataOptional(
  file: File
): Promise<ImageUploadMetadata | undefined> {
  if (!file.type.startsWith("image/") || file.type === "image/svg+xml") {
    return undefined;
  }
  try {
    return await extractImageMetadata(file);
  } catch {
    return undefined;
  }
}
