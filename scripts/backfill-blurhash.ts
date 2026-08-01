import { existsSync, readFileSync } from "fs";
import { join } from "path";
import { eq, isNull, and, like } from "drizzle-orm";
import { db } from "../src/db/index.js";
import { asset } from "../src/db/schema.js";
import { processImageMetadataWithSharp } from "../src/lib/image-metadata-node.js";

const ASSETS_DIR = join(process.cwd(), "data", "assets");

async function main() {
  console.log("🔍 Scanning for image assets without blurhash...");

  const targetAssets = await db
    .select()
    .from(asset)
    .where(
      and(
        isNull(asset.blurhash),
        like(asset.mimeType, "image/%")
      )
    );

  console.log(`📋 Found ${targetAssets.length} image asset(s) to process.`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const item of targetAssets) {
    const filepath = join(ASSETS_DIR, item.storageKey);
    if (!existsSync(filepath)) {
      console.warn(`⚠️ File not found for asset ${item.id} (${item.storageKey})`);
      skippedCount++;
      continue;
    }

    try {
      const buffer = readFileSync(filepath);
      const meta = await processImageMetadataWithSharp(buffer);

      if (meta?.blurhash) {
        await db
          .update(asset)
          .set({
            width: meta.width ?? item.width,
            height: meta.height ?? item.height,
            blurhash: meta.blurhash,
          })
          .where(eq(asset.id, item.id));

        console.log(`✅ Updated asset ${item.id} (${meta.width}x${meta.height}, blurhash: ${meta.blurhash})`);
        updatedCount++;
      } else {
        skippedCount++;
      }
    } catch (err) {
      console.error(`❌ Error processing asset ${item.id}:`, err);
      skippedCount++;
    }
  }

  console.log(`\n🎉 Backfill complete! Updated: ${updatedCount}, Skipped/Failed: ${skippedCount}`);
}

main().catch((err) => {
  console.error("Backfill script failed:", err);
  process.exit(1);
});
