import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");
const svg = await readFile(join(publicDir, "favicon.svg"));

const sizes = [
  { name: "apple-touch-icon.png", size: 180 },
  { name: "pwa-192.png", size: 192 },
  { name: "pwa-512.png", size: 512 },
  { name: "pwa-maskable-512.png", size: 512, maskable: true },
];

for (const { name, size, maskable } of sizes) {
  const inner = maskable ? Math.round(size * 0.8) : size;
  const padding = maskable ? Math.round((size - inner) / 2) : 0;

  let pipeline = sharp(svg).resize(inner, inner, {
    fit: "contain",
    background: "#fafaf9",
  });

  if (maskable) {
    pipeline = pipeline.extend({
      top: padding,
      bottom: padding,
      left: padding,
      right: padding,
      background: "#fafaf9",
    });
  }

  await pipeline.png().toFile(join(publicDir, name));
  console.log(`wrote ${name}`);
}
