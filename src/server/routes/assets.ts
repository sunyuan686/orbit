import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { db } from "../../db/index.js";
import { createAssetsRoutes } from "../../api/assets.js";
import { processImageMetadataWithSharp } from "../../lib/image-metadata-node.js";

const ASSETS_DIR = join(process.cwd(), "data", "assets");

const assets = createAssetsRoutes(
  () => db,
  {
    async save({ filename, body }) {
      mkdirSync(ASSETS_DIR, { recursive: true });

      const filepath = join(ASSETS_DIR, filename);
      if (!existsSync(filepath)) {
        writeFileSync(filepath, Buffer.from(body));
      }

      return `/assets/${filename}`;
    },
  },
  { processImageMetadata: processImageMetadataWithSharp }
);

export { assets };
