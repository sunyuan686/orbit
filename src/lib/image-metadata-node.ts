import sharp from "sharp";
import { encode } from "blurhash";

export interface ImageMetadata {
  width?: number;
  height?: number;
  blurhash?: string;
}

export async function processImageMetadataWithSharp(
  body: ArrayBuffer | Buffer
): Promise<ImageMetadata | undefined> {
  try {
    const image = sharp(Buffer.isBuffer(body) ? body : Buffer.from(body));
    const metadata = await image.metadata();
    const width = metadata.width ?? undefined;
    const height = metadata.height ?? undefined;

    const { data, info } = await image
      .raw()
      .ensureAlpha()
      .resize(32, 32, { fit: "inside" })
      .toBuffer({ resolveWithObject: true });

    const blurhash = encode(
      new Uint8ClampedArray(data),
      info.width,
      info.height,
      4,
      4
    );

    return { width, height, blurhash };
  } catch (e) {
    console.warn("Failed to process image blurhash metadata:", e);
    return undefined;
  }
}

const LIST_THUMB_EDGE = 480;
const LIST_THUMB_QUALITY = 82;

export async function createListThumbWebp(
  body: ArrayBuffer | Buffer
): Promise<Buffer | undefined> {
  try {
    const image = sharp(Buffer.isBuffer(body) ? body : Buffer.from(body));
    const metadata = await image.metadata();
    if (metadata.format === "gif" || metadata.format === "svg") return undefined;

    return await image
      .rotate()
      .resize(LIST_THUMB_EDGE, LIST_THUMB_EDGE, { fit: "inside", withoutEnlargement: true })
      .webp({ quality: LIST_THUMB_QUALITY })
      .toBuffer();
  } catch (e) {
    console.warn("Failed to create list thumbnail:", e);
    return undefined;
  }
}
