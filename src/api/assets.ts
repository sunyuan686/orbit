import { Hono } from "hono";
import type { Context } from "hono";
import { eq } from "drizzle-orm";
import { asset } from "../db/schema.js";
import { generateId } from "../lib/id.js";
import { transcribeAudioWithDashScope } from "../services/dashscope-voice.js";
import { transcribeAudioWithWorkersAi } from "../services/workers-ai-whisper.js";

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
  if (!name.includes(".")) return ".jpg";
  const ext = name.slice(name.lastIndexOf(".")).toLowerCase();
  if (ext === ".jpeg") return ".jpg";
  return ext;
}

function inferMimeType(file: File, ext: string): string {
  if (file.type) return file.type;
  // Audio
  if (ext === ".mp3") return "audio/mpeg";
  if (ext === ".wav") return "audio/wav";
  if (ext === ".m4a") return "audio/m4a";
  if (ext === ".ogg") return "audio/ogg";
  if (ext === ".aac") return "audio/aac";
  // Video
  if (ext === ".mp4") return "video/mp4";
  if (ext === ".mov") return "video/quicktime";
  if (ext === ".webm") return "video/webm";
  if (ext === ".mkv") return "video/x-matroska";
  // Image defaults
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

export function createAssetsRoutes(
  getDb: DbProvider,
  storage: AssetStorage,
  getEnv?: (c: Context) => any
) {
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
    let duration = parsePositiveInt(formData.get("duration"));
    let blurhash = parseClientBlurhash(formData.get("blurhash"));
    let transcript = (formData.get("transcript") as string | null) || undefined;

    // 如果是语音文件且前端未提供转写文本，尝试自动打字转写
    const isAudio =
      mimeType.startsWith("audio/") ||
      ext === ".webm" ||
      ext === ".m4a" ||
      ext === ".wav" ||
      ext === ".aac" ||
      ext === ".mp3" ||
      ext === ".ogg";

    if (isAudio && !transcript) {
      try {
        const env = getEnv ? getEnv(c) : ((c.env as any) || process.env);
        const dbInstance = await getDb(c);
        try {
          const res = await transcribeAudioWithDashScope(body, file.name || "recording.webm", env, undefined, dbInstance);
          if (res?.text) transcript = res.text.trim();
        } catch {
          const resText = await transcribeAudioWithWorkersAi(body, env);
          if (typeof resText === "string" && resText.trim()) transcript = resText.trim();
        }
      } catch {
        // 自动转写失败时不影响音频文件的正常上传存储
      }
    }

    const existingAsset = await db
      .select({
        id: asset.id,
        width: asset.width,
        height: asset.height,
        blurhash: asset.blurhash,
        duration: asset.duration,
        transcript: asset.transcript,
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
        duration: duration ?? null,
        transcript: transcript ?? null,
        createdAt: Math.floor(Date.now() / 1000),
      });
    } else {
      width = existingAsset.width ?? width;
      height = existingAsset.height ?? height;
      blurhash = existingAsset.blurhash ?? blurhash;
      duration = existingAsset.duration ?? duration;
      transcript = existingAsset.transcript ?? transcript;
    }

    return c.json({ url, filename, mimeType, width, height, blurhash, duration, transcript });
  });

  return assets;
}
