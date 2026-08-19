import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// PWA / App icon SVG: 满铺月石清白 (#fafaf9) 背景，纯净单轨双星，图案收敛在 ~65% 安全区内，无自带预设圆角
const pwaSvg = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#fafaf9"/>
  <g transform="translate(256 256) scale(11) translate(-16 -16)">
    <ellipse cx="16" cy="16" rx="11" ry="4.2" stroke="#78716c" stroke-width="1.3" transform="rotate(-22 16 16)"/>
    <circle cx="23.6" cy="12.2" r="1.8" fill="#292524"/>
    <circle cx="8.4" cy="19.8" r="1.2" fill="#ea580c"/>
  </g>
</svg>
`.trim();

const sizes = [
  { name: "apple-touch-icon.png", size: 180 },
  { name: "pwa-192.png", size: 192 },
  { name: "pwa-512.png", size: 512 },
  { name: "pwa-maskable-512.png", size: 512 },
];

for (const { name, size } of sizes) {
  await sharp(Buffer.from(pwaSvg))
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name));
  console.log(`wrote ${name} (${size}x${size})`);
}

