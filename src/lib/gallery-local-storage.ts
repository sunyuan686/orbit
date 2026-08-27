import { existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import type { GalleryObjectMeta } from "../services/content/gallery.js";
import { isImageStorageKey, thumbStorageKey } from "./gallery-keys.js";

const ASSETS_DIR = join(process.cwd(), "data", "assets");

export function listLocalGalleryObjects(): GalleryObjectMeta[] {
  if (!existsSync(ASSETS_DIR)) return [];

  return readdirSync(ASSETS_DIR)
    .filter((name) => isImageStorageKey(name))
    .map((name) => {
      const stat = statSync(join(ASSETS_DIR, name));
      return {
        key: name,
        size: stat.size,
        uploadedAt: Math.floor(stat.mtimeMs / 1000),
      };
    });
}

export function deleteLocalGalleryObject(key: string): boolean {
  const filepath = join(ASSETS_DIR, key);
  const thumbPath = join(ASSETS_DIR, thumbStorageKey(key));
  let deleted = false;
  if (existsSync(filepath)) {
    unlinkSync(filepath);
    deleted = true;
  }
  if (existsSync(thumbPath)) {
    unlinkSync(thumbPath);
  }
  return deleted;
}
