export interface ImageMetadata {
  width?: number;
  height?: number;
  blurhash?: string;
}

export type ProcessImageMetadata = (body: ArrayBuffer) => Promise<ImageMetadata | undefined>;
