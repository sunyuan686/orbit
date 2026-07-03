import { existsSync, readdirSync, statSync, unlinkSync } from "fs";
import { join } from "path";
import type { GalleryObjectMeta } from "../services/gallery.js";
import { isImageStorageKey } from "./gallery-keys.js";

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
  if (!existsSync(filepath)) return false;
  unlinkSync(filepath);
  return true;
}
