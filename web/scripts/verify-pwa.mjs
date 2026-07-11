#!/usr/bin/env node
/**
 * 校验 PWA 构建产物：manifest、Service Worker、图标与 index 注入。
 * 用法：先 `npm run build`，再 `node scripts/verify-pwa.mjs [baseUrl]`
 */
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const distDir = join(import.meta.dirname, "..", "dist");
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
  const distFiles = await readdir(distDir);
  const workboxFile = distFiles.find((name) => /^workbox-.+\.js$/.test(name));
  assert(workboxFile, "missing workbox-*.js");

  const required = [
    "manifest.webmanifest",
    "sw.js",
    "apple-touch-icon.png",
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
  assert(sw.includes("precacheAndRoute"), "sw.js missing precache");
  assert(sw.includes("NavigationRoute"), "sw.js missing SPA navigation fallback");
  assert(sw.includes("NetworkOnly"), "sw.js should keep API/media network-only");
  assert(sw.includes(String.raw`\/api\/`), "sw.js missing /api denylist");
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
