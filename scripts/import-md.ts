/**
 * 把现有 .md 文件导入 SQLite 数据库
 *
 * 处理：
 *   content/diary/daily.md       → entry（type: diary），按 ## YYYYMMDD 拆分
 *   content/diary/timeline.md    → entry（type: timeline），按 ## YYYYMMDD 拆分
 *   content/messages/留言板.md   → entry（type: message），按 <!-- msg | ... --> 拆分
 *   content/letters/信箱.md      → entry（type: letter），按 <!-- letter | ... --> 拆分
 *   content/memo/*.md            → memo 表，每个文件一条记录
 *
 * 信件 parentId：同一 round 的第一封信 parentId=null，后续回信指向该 round 第一封
 * 留言 parentId：均为 null（平铺按日期展示）
 *
 * title 规则：
 *   diary / timeline — 仅事件名（## YYYYMMDD 后的文字，不含日期）
 *   message / letter — 留空（null），后续由 AI 补全
 *
 * 用法：
 *   npm run db:import              # 执行导入（会清空 entry/asset/memo/settings 后重写）
 *   npm run db:import -- --dry-run   # 仅预览，不写数据库
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readFileSync, readdirSync, existsSync, mkdirSync } from "fs";
import { join, basename } from "path";
import * as schema from "../src/db/schema.js";

const CONTENT = join(process.cwd(), "content");
const DATA = join(process.cwd(), "data");
const DB_PATH = join(DATA, "orbit.db");
const MIGRATIONS_PATH = join(process.cwd(), "src/db/migrations");
const DRY_RUN = process.argv.includes("--dry-run");

const MARKER_RE = /^<!-- (letter|msg) \|(.+) -->\s*$/;

/** 数据库 entry.author 规范值 */
const AUTHORS = {
  yuan: "小圆子",
  zhi: "小麟子",
} as const;

/** marker / 历史别名 → 规范作者名 */
const AUTHOR_ALIASES: Record<string, string> = {
  小圆子: AUTHORS.yuan,
  sunyuan: AUTHORS.yuan,
  孙远: AUTHORS.yuan,
  yuan: AUTHORS.yuan,
  小麟子: AUTHORS.zhi,
  linzhi: AUTHORS.zhi,
  麟宝: AUTHORS.zhi,
  辛麟芝: AUTHORS.zhi,
  zhi: AUTHORS.zhi,
};

function normalizeAuthor(raw: string): string {
  const key = raw.trim();
  return AUTHOR_ALIASES[key] ?? key;
}

// --- ID 生成 ---
function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `${prefix}_${suffix}`;
}

// --- 日期解析 ---
function parseDatePrefix(str: string): number | undefined {
  const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (isNaN(date.getTime())) return undefined;
  return Math.floor(date.getTime() / 1000);
}

function parseMarkerDate(raw?: string): number | undefined {
  if (!raw) return undefined;
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const date = new Date(`${s}T00:00:00Z`);
    if (isNaN(date.getTime())) return undefined;
    return Math.floor(date.getTime() / 1000);
  }
  return parseDatePrefix(s);
}

function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

function toPlainText(md: string): string {
  return md
    .replace(/!\[[^\]]*\]\([^)]+\)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/^#+\s+/gm, "")
    .replace(/[*_~`]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// --- 按 ## YYYYMMDD 标题拆分（diary / timeline） ---
interface Section {
  title: string | null;
  body: string;
  entryDate?: number;
}

function splitBySections(markdown: string): Section[] {
  const clean = stripFrontmatter(markdown);
  const withoutH1 = clean.replace(/^# [^\n]*\n?/, "").trim();

  const lines = withoutH1.split("\n");
  const sections: Section[] = [];
  let currentTitle: string | null = null;
  let currentDate: number | undefined;
  let currentLines: string[] = [];

  const flush = () => {
    if (currentTitle || currentLines.length > 0) {
      const body = currentLines.join("\n").trim();
      sections.push({ title: currentTitle, body, entryDate: currentDate });
    }
  };

  for (const line of lines) {
    const h2Match = line.match(/^## (\S+)(.*)/);
    if (h2Match) {
      flush();
      const datePart = h2Match[1];
      const restPart = h2Match[2].trim();
      currentDate = parseDatePrefix(datePart);
      const cleanRest = restPart.replace(/!\[.*?\]\(.*?\)/g, "").trim();
      currentTitle = cleanRest || null;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections.filter((s) => s.title || s.body);
}

// --- 按 HTML 注释 marker 拆分（letter / message） ---
interface MarkerMeta {
  kind: "letter" | "msg";
  round?: number;
  author: string;
  date?: string;
}

interface MarkerChunk {
  meta: MarkerMeta;
  body: string;
}

function parseMarkerLine(line: string): MarkerMeta | null {
  const m = line.match(MARKER_RE);
  if (!m) return null;

  const kind = m[1] as "letter" | "msg";
  const fields: Record<string, string> = {};
  for (const part of m[2].split("|")) {
    const idx = part.indexOf(":");
    if (idx === -1) continue;
    const key = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    fields[key] = value;
  }

  return {
    kind,
    round: fields.round ? Number.parseInt(fields.round, 10) : undefined,
    author: fields.author ?? "",
    date: fields.date,
  };
}

function splitByMarkers(markdown: string, kind: "letter" | "msg"): MarkerChunk[] {
  const clean = stripFrontmatter(markdown);
  const lines = clean.split("\n");
  const chunks: MarkerChunk[] = [];

  let currentMeta: MarkerMeta | null = null;
  let currentLines: string[] = [];

  const flush = () => {
    if (!currentMeta) return;
    const body = currentLines.join("\n").trim();
    if (body) chunks.push({ meta: currentMeta, body });
  };

  for (const line of lines) {
    const meta = parseMarkerLine(line);
    if (meta && meta.kind === kind) {
      flush();
      currentMeta = meta;
      currentLines = [];
      continue;
    }
    if (currentMeta) currentLines.push(line);
  }
  flush();

  return chunks;
}

function extractAssetKeys(body: string): string[] {
  const keys: string[] = [];
  for (const m of body.matchAll(/!\[.*?\]\(assets\/([\w.-]+)\)/g)) {
    keys.push(m[1]);
  }
  return [...new Set(keys)];
}

function mimeFromKey(key: string): string {
  if (key.endsWith(".png")) return "image/png";
  if (key.endsWith(".webp")) return "image/webp";
  if (key.endsWith(".gif")) return "image/gif";
  return "image/jpeg";
}

// --- 导入上下文 ---
type Db = ReturnType<typeof drizzle<typeof schema>>;

interface EntryInsert {
  id: string;
  type: "diary" | "timeline" | "message" | "letter";
  author: string;
  title: string | null;
  body: string;
  bodyText: string;
  entryDate?: number;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
  modifiedBy?: string;
}

interface DryRunRow {
  type: string;
  title: string | null;
  author: string;
  entryDate?: string;
  parentId: string | null;
  parentLabel: string | null;
  bodyPreview: string;
  assetCount: number;
}

const dryRunRows: DryRunRow[] = [];
let entryCount = 0;
let assetCount = 0;

function insertEntry(db: Db | null, row: EntryInsert, assetKeys: string[]) {
  entryCount++;
  if (DRY_RUN) {
    dryRunRows.push({
      type: row.type,
      title: row.title,
      author: row.author,
      entryDate: row.entryDate ? formatDate(row.entryDate) : undefined,
      parentId: row.parentId,
      parentLabel: row.parentId ? "(round 首信)" : null,
      bodyPreview: row.bodyText.slice(0, 60) + (row.bodyText.length > 60 ? "…" : ""),
      assetCount: assetKeys.length,
    });
    return;
  }

  db!.insert(schema.entry).values({
    ...row,
    modifiedBy: row.modifiedBy ?? row.author,
  }).run();
  for (const key of assetKeys) {
    assetCount++;
    db!.insert(schema.asset)
      .values({
        id: generateId("ast"),
        entryId: row.id,
        storageKey: key,
        mimeType: mimeFromKey(key),
        createdAt: row.createdAt,
      })
      .run();
  }
}

function importSections(
  db: Db | null,
  sections: Section[],
  type: "diary" | "timeline",
  now: number
) {
  for (const sec of sections) {
    const ts = sec.entryDate ?? now;
    insertEntry(
      db,
      {
        id: generateId("ent"),
        type,
        author: AUTHORS.yuan,
        title: sec.title,
        body: sec.body,
        bodyText: toPlainText(sec.body),
        entryDate: sec.entryDate,
        parentId: null,
        createdAt: ts,
        updatedAt: ts,
      },
      extractAssetKeys(sec.body)
    );
  }
}

function importMessages(db: Db | null, markdown: string, now: number) {
  const chunks = splitByMarkers(markdown, "msg");
  for (const chunk of chunks) {
    const entryDate = parseMarkerDate(chunk.meta.date);
    const ts = entryDate ?? now;
    insertEntry(
      db,
      {
        id: generateId("ent"),
        type: "message",
        author: normalizeAuthor(chunk.meta.author),
        title: null,
        body: chunk.body,
        bodyText: toPlainText(chunk.body),
        entryDate,
        parentId: null,
        createdAt: ts,
        updatedAt: ts,
      },
      extractAssetKeys(chunk.body)
    );
  }
  return chunks.length;
}

function importLetters(db: Db | null, markdown: string, now: number) {
  const chunks = splitByMarkers(markdown, "letter");
  /** round → 该轮第一封信的 id（parentId 锚点） */
  const roundAnchor = new Map<number, string>();

  for (const chunk of chunks) {
    const round = chunk.meta.round;
    const entryDate = parseMarkerDate(chunk.meta.date);
    const ts = entryDate ?? now;
    const entryId = generateId("ent");

    let parentId: string | null = null;
    if (round !== undefined) {
      const anchor = roundAnchor.get(round);
      if (anchor) {
        parentId = anchor;
      } else {
        roundAnchor.set(round, entryId);
      }
    }

    insertEntry(
      db,
      {
        id: entryId,
        type: "letter",
        author: normalizeAuthor(chunk.meta.author),
        title: null,
        body: chunk.body,
        bodyText: toPlainText(chunk.body),
        entryDate,
        parentId,
        createdAt: ts,
        updatedAt: ts,
      },
      extractAssetKeys(chunk.body)
    );
  }
  return chunks.length;
}

// --- main ---
console.log(DRY_RUN ? "→ 预览模式（--dry-run），不写入数据库\n" : "→ 导入模式\n");

let db: Db | null = null;
let sqlite: Database.Database | null = null;
const now = Math.floor(Date.now() / 1000);

if (!DRY_RUN) {
  mkdirSync(DATA, { recursive: true });
  sqlite = new Database(DB_PATH);
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");
  db = drizzle(sqlite, { schema });

  console.log("→ 执行数据库迁移...");
  const tableReady = sqlite
    .prepare(
      "SELECT 1 FROM sqlite_master WHERE type='table' AND name='entry' LIMIT 1"
    )
    .get();
  if (tableReady) {
    console.log("→ 数据库已初始化，跳过迁移");
  } else {
    migrate(db, { migrationsFolder: MIGRATIONS_PATH });
  }

  db.delete(schema.asset).run();
  db.delete(schema.entry).run();
  db.delete(schema.memo).run();
  db.delete(schema.settings).run();
}

const dailyPath = join(CONTENT, "diary", "daily.md");
if (existsSync(dailyPath)) {
  const sections = splitBySections(readFileSync(dailyPath, "utf-8"));
  importSections(db, sections, "diary", now);
  console.log(`→ daily.md：${sections.length} 条 diary`);
}

const timelinePath = join(CONTENT, "diary", "timeline.md");
if (existsSync(timelinePath)) {
  const sections = splitBySections(readFileSync(timelinePath, "utf-8"));
  importSections(db, sections, "timeline", now);
  console.log(`→ timeline.md：${sections.length} 条 timeline`);
}

const msgPath = join(CONTENT, "messages", "留言板.md");
if (existsSync(msgPath)) {
  const count = importMessages(db, readFileSync(msgPath, "utf-8"), now);
  console.log(`→ 留言板.md：${count} 条 message`);
}

const letterPath = join(CONTENT, "letters", "信箱.md");
if (existsSync(letterPath)) {
  const count = importLetters(db, readFileSync(letterPath, "utf-8"), now);
  console.log(`→ 信箱.md：${count} 条 letter`);
}

if (!DRY_RUN) {
  const memoDir = join(CONTENT, "memo");
  if (existsSync(memoDir)) {
    const memoFiles = readdirSync(memoDir).filter((f) => f.endsWith(".md"));
    for (const file of memoFiles) {
      const raw = readFileSync(join(memoDir, file), "utf-8");
      const body = stripFrontmatter(raw);
      const key = basename(file, ".md");
      db!.insert(schema.memo)
        .values({
          id: generateId("mem"),
          key,
          title: key,
          body,
          author: AUTHORS.yuan,
          modifiedBy: AUTHORS.yuan,
          updatedAt: now,
        })
        .run();
    }
    console.log(`→ memo/：${memoFiles.length} 条备忘录`);
  }

  const defaultSettings = [
    { key: "anniversary_date", value: "20220519" },
    { key: "sunyuan_nickname", value: "小圆子" },
    { key: "linzhi_nickname", value: "小麟子" },
    { key: "theme", value: "light" },
  ];
  for (const s of defaultSettings) {
    db!.insert(schema.settings).values(s).run();
  }
  console.log("→ 初始化设置完成");
}

if (DRY_RUN) {
  console.log(`\n预览汇总：${entryCount} 条 entry，${dryRunRows.reduce((n, r) => n + r.assetCount, 0)} 条 asset（未写入）`);

  const letters = dryRunRows.filter((r) => r.type === "letter");
  const messages = dryRunRows.filter((r) => r.type === "message");
  if (letters.length > 0) {
    console.log("\n── 信件 sample（前 5 条）──");
    for (const row of letters.slice(0, 5)) {
      console.log(
        `  ${row.title ?? "?"} | ${row.author} | ${row.entryDate ?? "无日期"} | parent=${row.parentId ? "有" : "null"} | ${row.bodyPreview}`
      );
    }
    if (letters.length > 5) console.log(`  … 共 ${letters.length} 条`);
  }
  if (messages.length > 0) {
    console.log("\n── 留言 sample（前 3 条）──");
    for (const row of messages.slice(0, 3)) {
      console.log(
        `  ${row.entryDate ?? "无日期"} | ${row.author} | ${row.bodyPreview}`
      );
    }
    if (messages.length > 3) console.log(`  … 共 ${messages.length} 条`);
  }
  console.log("\n审核通过后执行：npm run db:import");
} else {
  const entryCnt = db!.select().from(schema.entry).all().length;
  const assetCnt = db!.select().from(schema.asset).all().length;
  const memoCnt = db!.select().from(schema.memo).all().length;
  console.log(`\n✓ 导入完成：${entryCnt} 条 entry，${assetCnt} 条 asset，${memoCnt} 条 memo`);
  sqlite!.close();
}
