import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { asset } from "../db/schema.js";
import { generateId } from "../lib/id.js";

type DbProvider = (c: Context) => any | Promise<any>;

interface SaveAssetInput {
  filename: string;
  mimeType: string;
  body: ArrayBuffer;
}

interface AssetStorage {
  save(input: SaveAssetInput, c: Context): Promise<string>;
}

async function sha256Prefix(body: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", body);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

function normalizeExtension(name: string): string {
  const ext = name.includes(".") ? name.slice(name.lastIndexOf(".")).toLowerCase() : ".jpg";
  return ext === ".jpeg" ? ".jpg" : ext;
}

function inferMimeType(file: File, ext: string): string {
  if (file.type) return file.type;
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function parsePositiveInt(raw: FormDataEntryValue | null): number | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const value = parseInt(raw, 10);
  return value > 0 ? value : undefined;
}

function parseClientBlurhash(raw: FormDataEntryValue | null): string | undefined {
  if (!raw || typeof raw !== "string") return undefined;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length >= 200) return undefined;
  return trimmed;
}

export function createAssetsRoutes(getDb: DbProvider, storage: AssetStorage) {
  const assets = new Hono();

  assets.post("/upload", async (c) => {
    const db = await getDb(c);
    const formData = await c.req.formData();
    const file = formData.get("file");
    const entryId = formData.get("entryId") as string | null;

    if (!file || !(file instanceof File)) {
      return c.json({ error: "no file" }, 400);
    }

    const body = await file.arrayBuffer();
    const ext = normalizeExtension(file.name || "upload.jpg");
    const filename = `${await sha256Prefix(body)}${ext}`;
    const mimeType = inferMimeType(file, ext);
    const url = await storage.save({ filename, mimeType, body }, c);

    let width = parsePositiveInt(formData.get("width"));
    let height = parsePositiveInt(formData.get("height"));
    let blurhash = parseClientBlurhash(formData.get("blurhash"));

    const existingAsset = await db
      .select({
        id: asset.id,
        width: asset.width,
        height: asset.height,
        blurhash: asset.blurhash,
      })
      .from(asset)
      .where(eq(asset.storageKey, filename))
      .get();

    if (!existingAsset) {
      await db.insert(asset).values({
        id: generateId("ast"),
        entryId: entryId || null,
        storageKey: filename,
        mimeType,
        size: body.byteLength,
        width: width ?? null,
        height: height ?? null,
        blurhash: blurhash ?? null,
        createdAt: Math.floor(Date.now() / 1000),
      });
    } else {
      width = existingAsset.width ?? width;
      height = existingAsset.height ?? height;
      blurhash = existingAsset.blurhash ?? blurhash;
    }

    return c.json({ url, filename, width, height, blurhash });
  });

  return assets;
}
