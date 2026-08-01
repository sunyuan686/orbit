/**
 * Backfill blurhash on remote D1 from local files or R2.
 *
 * Usage:
 *   npm run db:backfill-blurhash:remote -- --confirm
 *   npm run db:backfill-blurhash:remote -- --confirm --source r2
 *   npm run db:backfill-blurhash:remote -- --sql-only
 *
 * Requires wrangler auth for remote D1/R2. When local wrangler credentials fail,
 * use --sql-only and apply the generated SQL via Cloudflare dashboard or MCP.
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
import { processImageMetadataWithSharp } from "../src/lib/image-metadata-node.js";

const D1_NAME = "orbit-db";
const R2_BUCKET = "orbit-media";
const ASSETS_DIR = join(process.cwd(), "data", "assets");
const TMP_DIR = join(process.cwd(), "data", ".blurhash-backfill");

interface TargetRow {
  id: string;
  storage_key: string;
  width: number | null;
  height: number | null;
}

interface PendingUpdate {
  storageKey: string;
  blurhash: string;
  width?: number;
  height?: number;
}

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") {
    return Number.isFinite(value) ? String(Math.round(value)) : "NULL";
  }
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wranglerD1Json(command: string): unknown[] {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, "--remote", "--command", command, "--json"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  if (result.status !== 0) {
    throw new Error(
      `D1 query failed.\nstdout: ${result.stdout}\nstderr: ${result.stderr}`
    );
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
  const rows = wranglerD1Json(
    "SELECT id, storage_key, width, height FROM asset WHERE blurhash IS NULL AND mime_type LIKE 'image/%' AND deleted_at IS NULL"
  ) as TargetRow[];
  return rows;
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
    [
      "wrangler",
      "r2",
      "object",
      "get",
      `${R2_BUCKET}/${storageKey}`,
      "--remote",
      "--pipe",
    ],
    { cwd: process.cwd(), encoding: "buffer", maxBuffer: 50 * 1024 * 1024 }
  );

  if (result.status !== 0 || !result.stdout?.length) {
    return null;
  }

  return Buffer.from(result.stdout);
}

function buildUpdateStatement(update: PendingUpdate): string {
  return `UPDATE asset SET blurhash = ${sqlLiteral(update.blurhash)}, width = ${sqlLiteral(update.width)}, height = ${sqlLiteral(update.height)} WHERE storage_key = ${sqlLiteral(update.storageKey)} AND blurhash IS NULL`;
}

async function collectUpdates(
  targets: TargetRow[],
  source: "local" | "r2"
): Promise<{ updates: PendingUpdate[]; missing: string[]; skipped: string[] }> {
  const updates: PendingUpdate[] = [];
  const missing: string[] = [];
  const skipped: string[] = [];

  for (const item of targets) {
    const bytes = await readImageBytes(item.storage_key, source);
    if (!bytes) {
      missing.push(item.storage_key);
      continue;
    }

    try {
      const meta = await processImageMetadataWithSharp(bytes);
      if (!meta?.blurhash) {
        skipped.push(item.storage_key);
        continue;
      }

      updates.push({
        storageKey: item.storage_key,
        blurhash: meta.blurhash,
        width: meta.width ?? item.width ?? undefined,
        height: meta.height ?? item.height ?? undefined,
      });
    } catch {
      skipped.push(item.storage_key);
    }
  }

  return { updates, missing, skipped };
}

function applyUpdatesInBatches(updates: PendingUpdate[], batchSize = 20): void {
  mkdirSync(TMP_DIR, { recursive: true });

  for (let i = 0; i < updates.length; i += batchSize) {
    const batch = updates.slice(i, i + batchSize);
    const sql = batch.map(buildUpdateStatement).join(";\n") + ";\n";
    const file = join(TMP_DIR, `batch-${String(i).padStart(4, "0")}.sql`);
    writeFileSync(file, sql, "utf8");
    executeSqlFile(file, `batch ${i / batchSize + 1}/${Math.ceil(updates.length / batchSize)}`);
  }
}

function writeSqlFile(updates: PendingUpdate[], outfile: string): void {
  const sql = updates.map(buildUpdateStatement).join(";\n") + ";\n";
  writeFileSync(outfile, sql, "utf8");
}

async function main() {
  const args = process.argv.slice(2);
  const confirmed = args.includes("--confirm");
  const sqlOnly = args.includes("--sql-only");
  const source = args.includes("--source=r2") ? "r2" : "local";
  const targetsFileArg = args.find((a) => a.startsWith("--targets-file="));
  const targetsFile = targetsFileArg?.split("=")[1];

  if (!sqlOnly && !confirmed) {
    console.error(
      "Refusing to modify remote D1 without --confirm (or use --sql-only)."
    );
    process.exit(1);
  }

  let targets: TargetRow[];
  if (targetsFile) {
    targets = JSON.parse(readFileSync(targetsFile, "utf8")) as TargetRow[];
    console.log(`Loaded ${targets.length} target(s) from ${targetsFile}`);
  } else {
    console.log("Fetching targets from remote D1...");
    targets = fetchRemoteTargets();
    console.log(`Found ${targets.length} image asset(s) without blurhash.`);
  }

  const { updates, missing, skipped } = await collectUpdates(targets, source);

  console.log(`Ready to update: ${updates.length}`);
  console.log(`Missing source file: ${missing.length}`);
  console.log(`Skipped (no blurhash): ${skipped.length}`);

  if (missing.length > 0) {
    console.warn("Missing files:", missing.slice(0, 10).join(", "), missing.length > 10 ? "..." : "");
  }

  mkdirSync(TMP_DIR, { recursive: true });
  const outfile = join(TMP_DIR, "updates.sql");
  writeSqlFile(updates, outfile);
  console.log(`SQL written to ${outfile}`);

  if (sqlOnly) {
    return;
  }

  console.log("Applying updates to remote D1...");
  applyUpdatesInBatches(updates);
  rmSync(TMP_DIR, { recursive: true, force: true });
  console.log("Remote blurhash backfill complete.");
}

main().catch((err) => {
  console.error("Remote blurhash backfill failed:", err);
  process.exit(1);
});
