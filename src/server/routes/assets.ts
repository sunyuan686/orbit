import { Hono } from "hono";
import { writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { asset } from "../../db/schema.js";

const ASSETS_DIR = join(process.cwd(), "data", "assets");

const assets = new Hono();

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `${prefix}_${suffix}`;
}

// POST /api/assets/upload
assets.post("/upload", async (c) => {
  const formData = await c.req.formData();
  const file = formData.get("file");
  const entryId = formData.get("entryId") as string | null;

  if (!file || !(file instanceof File)) {
    return c.json({ error: "no file" }, 400);
  }

  const buf = Buffer.from(await file.arrayBuffer());
  const hash = createHash("sha256").update(buf).digest("hex").slice(0, 8);

  const name = file.name || "upload.jpg";
  let ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : ".jpg";
  if (ext === ".jpeg") ext = ".jpg";

  const filename = `${hash}${ext}`;
  mkdirSync(ASSETS_DIR, { recursive: true });

  const filepath = join(ASSETS_DIR, filename);
  if (!existsSync(filepath)) {
    writeFileSync(filepath, buf);
  }

  const url = `/assets/${filename}`;
  const mimeType = file.type || (ext === ".png" ? "image/png" : "image/jpeg");

  // 写入 asset 表
  const existingAsset = await db
    .select({ id: asset.id })
    .from(asset)
    .where(eq(asset.storageKey, filename))
    .get();

  if (!existingAsset) {
    await db.insert(asset).values({
      id: generateId("ast"),
      entryId: entryId || null,
      storageKey: filename,
      url,
      mimeType,
      size: buf.length,
      createdAt: Math.floor(Date.now() / 1000),
    });
  }

  return c.json({ url, filename });
});

export { assets };
