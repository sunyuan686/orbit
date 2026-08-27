#!/usr/bin/env node
/**
 * 校验 PWA 构建产物：manifest、Service Worker、图标与 index 注入。
 * 用法：先 `npm run build`，再 `node scripts/verify-pwa.mjs [baseUrl]`
 */
import { readFile, readdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const distDir = join(__dirname, "..", "dist");
const baseUrl = process.argv[2] ?? "";

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

async function readDist(file) {
  return readFile(join(distDir, file), "utf8");
}

async function verifyDistFiles() {
  const required = [
    "manifest.webmanifest",
    "sw.js",
    "apple-touch-icon.png",
    "apple-touch-icon-dark.png",
    "pwa-192.png",
    "pwa-512.png",
    "pwa-maskable-512.png",
  ];

  for (const file of required) {
    await readDist(file).catch(() => {
      throw new Error(`missing dist file: ${file}`);
    });
  }

  const manifest = JSON.parse(await readDist("manifest.webmanifest"));
  assert(manifest.name === "Orbit", "manifest.name should be Orbit");
  assert(manifest.display === "standalone", "manifest.display should be standalone");
  assert(manifest.start_url === "/", "manifest.start_url should be /");
  assert(Array.isArray(manifest.icons) && manifest.icons.length >= 3, "manifest.icons missing");

  const html = await readDist("index.html");
  assert(html.includes('rel="manifest"'), "index.html missing manifest link");
  assert(html.includes("apple-touch-icon"), "index.html missing apple-touch-icon");

  const sw = await readDist("sw.js");
  assert(sw.includes("manifest.webmanifest") || sw.includes("pwa-192.png"), "sw.js missing precache entries");
  assert(/fonts\\?\.googleapis\\?\.com/.test(sw), "sw.js missing Google Fonts stylesheets cache");
  assert(/fonts\\?\.gstatic\\?\.com/.test(sw), "sw.js missing Google Fonts webfonts cache");
  assert(sw.includes('"push"') || sw.includes("'push'"), "sw.js missing push event listener");
  assert(sw.includes('"notificationclick"') || sw.includes("'notificationclick'"), "sw.js missing notificationclick event listener");
}

async function verifyHttp() {
  if (!baseUrl) return;

  const endpoints = [
    "/manifest.webmanifest",
    "/sw.js",
    "/pwa-192.png",
    "/pwa-512.png",
    "/",
  ];

  for (const path of endpoints) {
    const res = await fetch(new URL(path, baseUrl));
    assert(res.ok, `${path} returned ${res.status}`);
  }

  const manifest = await fetch(new URL("/manifest.webmanifest", baseUrl)).then((res) =>
    res.json()
  );
  assert(manifest.short_name === "Orbit", "live manifest.short_name mismatch");
}

await verifyDistFiles();
await verifyHttp();
console.log(baseUrl ? `PWA verification passed (${baseUrl})` : "PWA dist verification passed");
