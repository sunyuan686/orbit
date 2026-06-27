/**
 * 【一次性 / 灾难恢复】将本地 SQLite（data/orbit.db）业务数据导入远程 D1。
 *
 * 不会清空远程数据，但重复执行会因主键冲突失败或产生混乱。
 * 生产 D1 已有数据时，默认拒绝运行。
 *
 * 用法：npx tsx scripts/archive/migrate-sqlite-to-d1.ts --confirm
 */

import Database from "better-sqlite3";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const DB_PATH = join(process.cwd(), "data/orbit.db");
const D1_NAME = "orbit-db";
const TMP_DIR = join(process.cwd(), "data/.d1-migrate");

type Row = Record<string, unknown>;

const confirmed = process.argv.includes("--confirm");

function sqlLiteral(value: unknown): string {
  if (value === null || value === undefined) return "NULL";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "NULL";
  if (typeof value === "boolean") return value ? "1" : "0";
  return `'${String(value).replace(/'/g, "''")}'`;
}

function wranglerD1Json(command: string): unknown[] {
  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, "--remote", "--command", command, "--json"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`D1 query failed: ${command}`);
  }

  const payload = JSON.parse(result.stdout) as Array<{ results?: unknown[] }>;
  return payload[0]?.results ?? [];
}

function remoteRowCount(table: string): number {
  const rows = wranglerD1Json(`SELECT COUNT(*) AS c FROM ${table}`) as Array<{ c: number }>;
  return Number(rows[0]?.c ?? 0);
}

function executeSql(sql: string, label: string): void {
  mkdirSync(TMP_DIR, { recursive: true });
  const file = join(
    TMP_DIR,
    `batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.sql`
  );
  writeFileSync(file, sql, "utf8");

  const result = spawnSync(
    "npx",
    ["wrangler", "d1", "execute", D1_NAME, "--file", file, "--remote"],
    { cwd: process.cwd(), encoding: "utf8" }
  );

  if (result.status !== 0) {
    console.error(result.stdout);
    console.error(result.stderr);
    throw new Error(`D1 execute failed: ${label}`);
  }
  console.log(`  ✓ ${label}`);
}

function batchInsert(
  table: string,
  columns: string[],
  rows: Row[],
  batchSize = 25
): void {
  if (rows.length === 0) {
    console.log(`  · ${table}: 0 rows, skip`);
    return;
  }

  for (let i = 0; i < rows.length; i += batchSize) {
    const chunk = rows.slice(i, i + batchSize);
    const cols = columns.map((c) => `\`${c}\``).join(", ");
    const values = chunk
      .map((row) => `(${columns.map((c) => sqlLiteral(row[c])).join(", ")})`)
      .join(",\n");
    const sql = `INSERT INTO \`${table}\` (${cols}) VALUES\n${values};`;
    executeSql(sql, `${table} ${i + 1}-${i + chunk.length}/${rows.length}`);
  }

  console.log(`  ✓ ${table}: ${rows.length} rows imported`);
}

function queryAll(sqlite: Database.Database, sql: string): Row[] {
  return sqlite.prepare(sql).all() as Row[];
}

if (!confirmed) {
  console.error("拒绝执行：这是一次性数据导入脚本，可能污染已有生产数据。");
  console.error("若确认远程 D1 为空或你要做灾难恢复，请追加 --confirm：");
  console.error("  npx tsx scripts/archive/migrate-sqlite-to-d1.ts --confirm");
  process.exit(1);
}

if (!existsSync(DB_PATH)) {
  console.error(`错误：找不到本地数据库 ${DB_PATH}`);
  process.exit(1);
}

const remoteUsers = remoteRowCount("user");
const remoteEntries = remoteRowCount("entry");
if (remoteUsers > 0 || remoteEntries > 0) {
  console.error("拒绝执行：远程 D1 已有业务数据。");
  console.error(`  user=${remoteUsers}, entry=${remoteEntries}`);
  console.error("本脚本不会 DELETE，但重复 INSERT 会失败或造成混乱。");
  console.error("如需覆盖生产数据，请先在 Cloudflare 控制台处理 D1，勿误跑本脚本。");
  process.exit(1);
}

console.log("→ SQLite → D1 数据导入（一次性）\n");
console.log(`  source: ${DB_PATH}`);
console.log(`  target: ${D1_NAME} (remote)\n`);

const sqlite = new Database(DB_PATH, { readonly: true });

console.log("1/7 user");
batchInsert(
  "user",
  ["id", "name", "email", "email_verified", "image", "created_at", "updated_at"],
  queryAll(sqlite, "SELECT * FROM user ORDER BY created_at")
);

console.log("2/7 account");
batchInsert(
  "account",
  [
    "id",
    "account_id",
    "provider_id",
    "user_id",
    "access_token",
    "refresh_token",
    "id_token",
    "access_token_expires_at",
    "refresh_token_expires_at",
    "scope",
    "password",
    "created_at",
    "updated_at",
  ],
  queryAll(sqlite, "SELECT * FROM account ORDER BY created_at")
);

console.log("3/7 entry");
batchInsert(
  "entry",
  [
    "id",
    "type",
    "user_id",
    "author",
    "title",
    "body",
    "body_text",
    "entry_date",
    "parent_id",
    "created_at",
    "updated_at",
    "deleted_at",
    "modified_by",
  ],
  queryAll(
    sqlite,
    `SELECT * FROM entry
     ORDER BY (parent_id IS NULL) DESC, created_at`
  ),
  15
);

console.log("4/7 asset");
batchInsert(
  "asset",
  [
    "id",
    "entry_id",
    "storage_key",
    "mime_type",
    "width",
    "height",
    "size",
    "position",
    "created_at",
    "deleted_at",
  ],
  queryAll(sqlite, "SELECT * FROM asset ORDER BY created_at")
);

console.log("5/7 memo");
batchInsert(
  "memo",
  [
    "id",
    "key",
    "title",
    "body",
    "created_at",
    "updated_at",
    "deleted_at",
    "author",
    "modified_by",
  ],
  queryAll(sqlite, "SELECT * FROM memo ORDER BY created_at")
);

console.log("6/7 settings");
batchInsert(
  "settings",
  ["key", "value", "updated_at"],
  queryAll(sqlite, "SELECT * FROM settings ORDER BY key")
);

console.log("7/7 audit_log");
batchInsert(
  "audit_log",
  [
    "id",
    "user_id",
    "author",
    "action",
    "resource_type",
    "resource_id",
    "metadata",
    "request_id",
    "created_at",
  ],
  queryAll(sqlite, "SELECT * FROM audit_log ORDER BY created_at")
);

console.log("\n→ FTS rebuild");
executeSql("INSERT INTO entry_fts(entry_fts) VALUES ('rebuild');", "entry_fts rebuild");
executeSql("INSERT INTO memo_fts(memo_fts) VALUES ('rebuild');", "memo_fts rebuild");

rmSync(TMP_DIR, { recursive: true, force: true });

console.log("\n✓ 数据导入完成");
