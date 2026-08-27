import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, "..", "public");

// 亮色版: 满铺月石清白 (#fafaf9) 背景
const pwaSvgLight = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#fafaf9"/>
  <g transform="translate(256 256) scale(11) translate(-16 -16)">
    <ellipse cx="16" cy="16" rx="11" ry="4.2" stroke="#78716c" stroke-width="1.3" transform="rotate(-22 16 16)"/>
    <circle cx="23.6" cy="12.2" r="1.8" fill="#292524"/>
    <circle cx="8.4" cy="19.8" r="1.2" fill="#ea580c"/>
  </g>
</svg>
`.trim();

// 暗色版: 满铺深石墨黑 (#1c1917) 背景
const pwaSvgDark = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect width="512" height="512" fill="#1c1917"/>
  <g transform="translate(256 256) scale(11) translate(-16 -16)">
    <ellipse cx="16" cy="16" rx="11" ry="4.2" stroke="#57534e" stroke-width="1.3" transform="rotate(-22 16 16)"/>
    <circle cx="23.6" cy="12.2" r="1.8" fill="#fafaf9"/>
    <circle cx="8.4" cy="19.8" r="1.2" fill="#fb923c"/>
  </g>
</svg>
`.trim();

const icons = [
  { name: "apple-touch-icon.png", size: 180, svg: pwaSvgLight },
  { name: "apple-touch-icon-dark.png", size: 180, svg: pwaSvgDark },
  { name: "pwa-192.png", size: 192, svg: pwaSvgLight },
  { name: "pwa-512.png", size: 512, svg: pwaSvgLight },
  { name: "pwa-maskable-512.png", size: 512, svg: pwaSvgLight },
];

for (const { name, size, svg } of icons) {
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .png()
    .toFile(join(publicDir, name));
  console.log(`wrote ${name} (${size}x${size})`);
}


