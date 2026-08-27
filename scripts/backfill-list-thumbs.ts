import { existsSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { and, eq, isNull, like } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { asset } from "../src/db/schema.js";
import { createListThumbWebp } from "../src/lib/image-metadata-node.js";
import { canMakeListThumb, thumbStorageKey } from "../src/lib/gallery-keys.js";

const ASSETS_DIR = join(process.cwd(), "data", "assets");

async function main() {
  console.log("Scanning assets without list thumbnails...");

  const targets = await db
    .select()
    .from(asset)
    .where(
      and(
        eq(asset.hasThumb, 0),
        isNull(asset.deletedAt),
        like(asset.mimeType, "image/%")
      )
    );

  console.log(`Found ${targets.length} image asset(s) to process.`);

  let updated = 0;
  let skipped = 0;

  for (const item of targets) {
    if (!canMakeListThumb(item.mimeType || "")) {
      skipped++;
      continue;
    }

    const filepath = join(ASSETS_DIR, item.storageKey);
    if (!existsSync(filepath)) {
      console.warn(`Missing file ${item.storageKey}`);
      skipped++;
      continue;
    }

    try {
      const thumb = await createListThumbWebp(readFileSync(filepath));
      if (!thumb) {
        skipped++;
        continue;
      }
      writeFileSync(join(ASSETS_DIR, thumbStorageKey(item.storageKey)), thumb);
      await db
        .update(asset)
        .set({ hasThumb: 1 })
        .where(eq(asset.id, item.id));
      console.log(`Wrote thumb for ${item.storageKey}`);
      updated++;
    } catch (err) {
      console.error(`Failed ${item.storageKey}:`, err);
      skipped++;
    }
  }

  console.log(`Done. Updated: ${updated}, skipped: ${skipped}`);
}

main().catch((err) => {
  console.error("Thumb backfill failed:", err);
  process.exit(1);
});
