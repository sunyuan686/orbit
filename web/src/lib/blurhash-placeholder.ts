/**
 * Blurhash to Data URL (Workers-compatible)
 *
 * Decodes a blurhash to a tiny BMP image encoded as a base64 data URL.
 * Uses raw BMP encoding (no Canvas/DOM needed) so it works in
 * Cloudflare Workers and Node.js alike.
 *
 * The resulting tiny image is stretched by the browser via CSS
 * `background-size: cover` with `image-rendering: auto` (default),
 * which applies bilinear interpolation for a natural blur effect.
 */

import { decode } from "blurhash";

const DEFAULT_BLURHASH_WIDTH = 4;
const DEFAULT_BLURHASH_HEIGHT = 3;
const DEFAULT_BLURHASH_LONGEST_SIDE = 16;

/**
 * Pick tiny decode dimensions that preserve the source aspect ratio.
 */
export function getBlurhashDecodeSize(
  width?: number,
  height?: number,
  longestSide = DEFAULT_BLURHASH_LONGEST_SIDE,
): { width: number; height: number } {
  if (
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    !width ||
    !height ||
    width <= 0 ||
    height <= 0
  ) {
    return {
      width: DEFAULT_BLURHASH_WIDTH,
      height: DEFAULT_BLURHASH_HEIGHT,
    };
  }

  const edge =
    Number.isFinite(longestSide) && longestSide > 0
      ? Math.round(longestSide)
      : DEFAULT_BLURHASH_LONGEST_SIDE;

  if (width >= height) {
    return {
      width: edge,
      height: Math.max(1, Math.round((height / width) * edge)),
    };
  }

  return {
    width: Math.max(1, Math.round((width / height) * edge)),
    height: edge,
  };
}

/**
 * Build a tiny placeholder data URL from blurhash and optional source dimensions.
 */
export function getMediaPlaceholderDataUrl(
  blurhash?: string | null,
  width?: number | null,
  height?: number | null,
): string | undefined {
  if (!blurhash) return undefined;
  const decodeSize = getBlurhashDecodeSize(width ?? undefined, height ?? undefined);
  return blurhashToDataUrl(blurhash, decodeSize.width, decodeSize.height);
}

/**
 * Convert a blurhash string to a base64-encoded BMP data URL.
 */
export function blurhashToDataUrl(hash: string, width = 4, height = 3): string {
  try {
    const pixels = decode(hash, width, height);
    const bmp = encodeBMP(pixels, width, height);
    return "data:image/bmp;base64," + uint8ToBase64(bmp);
  } catch (err) {
    console.warn("Failed to decode blurhash:", err);
    return "";
  }
}

/**
 * Encode RGBA pixel data into a BMP file (24-bit, bottom-up).
 */
function encodeBMP(
  pixels: Uint8ClampedArray,
  w: number,
  h: number,
): Uint8Array {
  // BMP row stride must be a multiple of 4 bytes
  const rowSize = Math.ceil((w * 3) / 4) * 4;
  const pixelDataSize = rowSize * h;
  const fileSize = 54 + pixelDataSize; // 14 (file header) + 40 (DIB header) + pixels

  const buf = new Uint8Array(fileSize);
  const view = new DataView(buf.buffer);

  // -- BMP File Header (14 bytes) --
  buf[0] = 0x42; // 'B'
  buf[1] = 0x4d; // 'M'
  view.setUint32(2, fileSize, true);
  view.setUint32(10, 54, true); // pixel data offset

  // -- DIB Header (BITMAPINFOHEADER, 40 bytes) --
  view.setUint32(14, 40, true); // header size
  view.setInt32(18, w, true); // width
  view.setInt32(22, h, true); // height (positive = bottom-up)
  view.setUint16(26, 1, true); // color planes
  view.setUint16(28, 24, true); // bits per pixel

  // -- Pixel data (bottom-up, BGR) --
  for (let y = 0; y < h; y++) {
    const srcRow = (h - 1 - y) * w; // BMP is bottom-up
    const dstRow = 54 + y * rowSize;
    for (let x = 0; x < w; x++) {
      const srcIdx = (srcRow + x) * 4;
      const dstIdx = dstRow + x * 3;
      buf[dstIdx] = pixels[srcIdx + 2] ?? 0; // B
      buf[dstIdx + 1] = pixels[srcIdx + 1] ?? 0; // G
      buf[dstIdx + 2] = pixels[srcIdx] ?? 0; // R
    }
  }

  return buf;
}

/**
 * Base64-encode a Uint8Array without relying on btoa or Buffer.
 */
function uint8ToBase64(bytes: Uint8Array): string {
  const chars =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  const len = bytes.length;

  for (let i = 0; i < len; i += 3) {
    const b0 = bytes[i] as number;
    const b1 = i + 1 < len ? (bytes[i + 1] as number) : 0;
    const b2 = i + 2 < len ? (bytes[i + 2] as number) : 0;

    result += chars[b0 >> 2];
    result += chars[((b0 & 3) << 4) | (b1 >> 4)];
    result += i + 1 < len ? chars[((b1 & 15) << 2) | (b2 >> 6)] : "=";
    result += i + 2 < len ? chars[b2 & 63] : "=";
  }

  return result;
}
