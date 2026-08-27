/**
 * Backfill list thumbs on remote R2 + D1.
 *
 *   npm run db:backfill-thumbs:remote -- --confirm
 *   npm run db:backfill-thumbs:remote -- --confirm --source r2
 *   npm run db:backfill-thumbs:remote -- --sql-only
 */

import { spawnSync } from "child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "fs";
import { join } from "path";
import { createListThumbWebp } from "../src/lib/image-metadata-node.js";
import { canMakeListThumb, thumbStorageKey } from "../src/lib/gallery-keys.js";

const D1_NAME = "orbit-db";
const R2_BUCKET = "orbit-media";
const ASSETS_DIR = join(process.cwd(), "data", "assets");
const TMP_DIR = join(process.cwd(), "data", ".thumb-backfill");

interface TargetRow {
  id: string;
  storage_key: string;
  mime_type: string | null;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wranglerD1Json(command: string): unknown[] {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, "--remote", "--command", command, "--json"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  if (result.status !== 0) {
    throw new Error(`D1 query failed.\n${result.stdout}\n${result.stderr}`);
  }
  const payload = JSON.parse(result.stdout) as Array<{ results?: unknown[] }>;
  return payload[0]?.results ?? [];
}

function executeSqlFile(file: string, label: string): void {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, "--file", file, "--remote", "-y"],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`D1 execute failed: ${label}`);
  }
}

function fetchRemoteTargets(): TargetRow[] {
  return wranglerD1Json(
    "SELECT id, storage_key, mime_type FROM asset WHERE has_thumb = 0 AND deleted_at IS NULL AND mime_type LIKE 'image/%' AND mime_type != 'image/gif'"
  ) as TargetRow[];
}

async function readImageBytes(
  storageKey: string,
  source: "local" | "r2"
): Promise<Buffer | null> {
  if (source === "local") {
    const filepath = join(ASSETS_DIR, storageKey);
    if (!existsSync(filepath)) return null;
    return readFileSync(filepath);
  }

  const result = spawnSync(
    "npx",
    ["wrangler", "r2", "object", "get", `${R2_BUCKET}/${storageKey}`, "--remote", "--pipe"],
    { cwd: process.cwd(), encoding: "buffer", maxBuffer: 50 * 1024 * 1024 }
  );
  if (result.status !== 0 || !result.stdout?.length) return null;
  return Buffer.from(result.stdout);
}

function putRemoteThumb(storageKey: string, body: Buffer): boolean {
  mkdirSync(TMP_DIR, { recursive: true });
  const tmp = join(TMP_DIR, thumbStorageKey(storageKey));
  writeFileSync(tmp, body);
  const result = spawnSync(
    "npx",
    [
      "wrangler",
      "r2",
      "object",
      "put",
      `${R2_BUCKET}/${thumbStorageKey(storageKey)}`,
      "--file",
      tmp,
      "--content-type",
      "image/webp",
      "--remote",
    ],
    { cwd: process.cwd(), encoding: "utf8" }
  );
  return result.status === 0;
}

async function main() {
  const args = process.argv.slice(2);
  const confirmed = args.includes("--confirm");
  const sqlOnly = args.includes("--sql-only");
  const source = args.includes("--source=r2") ? "r2" : "local";

  if (!sqlOnly && !confirmed) {
    console.error("Refusing to modify remote without --confirm (or use --sql-only).");
    process.exit(1);
  }

  console.log("Fetching targets from remote D1...");
  const targets = fetchRemoteTargets();
  console.log(`Found ${targets.length} image(s) without thumbs.`);

  const updated: string[] = [];
  const skipped: string[] = [];
  mkdirSync(TMP_DIR, { recursive: true });

  for (const item of targets) {
    if (!canMakeListThumb(item.mime_type || "image/jpeg")) {
      skipped.push(item.storage_key);
      continue;
    }
    const bytes = await readImageBytes(item.storage_key, source);
    if (!bytes) {
      skipped.push(item.storage_key);
      continue;
    }
    const thumb = await createListThumbWebp(bytes);
    if (!thumb) {
      skipped.push(item.storage_key);
      continue;
    }
    if (!sqlOnly && !putRemoteThumb(item.storage_key, thumb)) {
      console.error(`R2 put failed for ${item.storage_key}`);
      skipped.push(item.storage_key);
      continue;
    }
    updated.push(item.storage_key);
    console.log(`Thumb ready for ${item.storage_key}`);
  }

  const sql = updated
    .map(
      (key) =>
        `UPDATE asset SET has_thumb = 1 WHERE storage_key = ${sqlLiteral(key)} AND has_thumb = 0;`
    )
    .join("\n");
  const sqlFile = join(TMP_DIR, "updates.sql");
  writeFileSync(sqlFile, sql || "-- none\n", "utf8");
  console.log(`SQL written to ${sqlFile} (${updated.length} updates, ${skipped.length} skipped)`);

  if (sqlOnly) return;

  if (updated.length > 0) {
    executeSqlFile(sqlFile, "has_thumb updates");
  }
  rmSync(TMP_DIR, { recursive: true, force: true });
  console.log("Remote thumb backfill complete.");
}

main().catch((err) => {
  console.error("Remote thumb backfill failed:", err);
  process.exit(1);
});
