/**
 * 把现有 .md 文件导入 SQLite 数据库
 *
 * 处理：
 *   data/diary/daily.md       → entry 表（type: diary），按 ## YYYYMMDD 拆分
 *   data/diary/timeline.md    → entry 表（type: letter），按 ## YYYYMMDD 拆分
 *   data/messages/留言板.md   → entry 表（type: message），整体一条记录
 *   data/letters/信箱.md      → entry 表（type: letter），整体一条记录
 *   data/memo/*.md            → memo 表，每个文件一条记录
 *
 * 同时提取正文中的 assets/xxx.jpg 引用，写入 asset 表
 */

import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import { readFileSync, readdirSync, existsSync } from "fs";
import { join, basename } from "path";
import * as schema from "../src/db/schema.js";

const DATA = join(process.cwd(), "data");
const DB_PATH = join(DATA, "orbit.db");
const MIGRATIONS_PATH = join(process.cwd(), "src/db/migrations");

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
// 从 "20220403事件名" 或 "20220403" 提取 Unix 时间戳（UTC 午夜）
function parseDatePrefix(str: string): number | undefined {
  const match = str.match(/^(\d{4})(\d{2})(\d{2})/);
  if (!match) return undefined;
  const [, y, m, d] = match;
  const date = new Date(`${y}-${m}-${d}T00:00:00Z`);
  if (isNaN(date.getTime())) return undefined;
  return Math.floor(date.getTime() / 1000);
}

// Unix 时间戳格式化（用于标题显示）
function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// --- Frontmatter 解析 ---
function stripFrontmatter(content: string): string {
  return content.replace(/^---\n[\s\S]*?\n---\n?/, "").trim();
}

// --- 按 ## YYYYMMDD 标题拆分 ---
interface Section {
  title: string;
  body: string;
  entryDate?: number;
}

function splitBySections(markdown: string): Section[] {
  const clean = stripFrontmatter(markdown);
  // 去掉开头的 # 一级标题行
  const withoutH1 = clean.replace(/^# [^\n]*\n?/, "").trim();

  const lines = withoutH1.split("\n");
  const sections: Section[] = [];
  let currentTitle = "";
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
      // 标题 = 日期字符串 + 剩余文字
      currentTitle = currentDate
        ? `${formatDate(currentDate)}${restPart ? " " + restPart : ""}`
        : `${datePart}${restPart ? " " + restPart : ""}`;
      currentLines = [];
    } else {
      currentLines.push(line);
    }
  }
  flush();

  return sections.filter((s) => s.title || s.body);
}

// --- 提取 assets/ 图片引用 ---
function extractAssetKeys(body: string): string[] {
  const matches = body.matchAll(/!\[.*?\]\(assets\/([\w.-]+)\)/g);
  const keys: string[] = [];
  for (const m of matches) {
    keys.push(m[1]);
  }
  return [...new Set(keys)];
}

// --- 初始化 DB ---
const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

console.log("→ 执行数据库迁移...");
migrate(db, { migrationsFolder: MIGRATIONS_PATH });

// 清空旧数据（幂等重跑）
db.delete(schema.asset).run();
db.delete(schema.entry).run();
db.delete(schema.memo).run();
db.delete(schema.settings).run();

const now = Math.floor(Date.now() / 1000);

// --- 导入 daily.md（日记，按事件拆分） ---
const dailyPath = join(DATA, "diary", "daily.md");
if (existsSync(dailyPath)) {
  const sections = splitBySections(readFileSync(dailyPath, "utf-8"));
  console.log(`→ daily.md：${sections.length} 条日记事件`);

  for (const sec of sections) {
    const entryId = generateId("ent");
    db.insert(schema.entry)
      .values({
        id: entryId,
        type: "diary",
        title: sec.title,
        body: sec.body,
        entryDate: sec.entryDate,
        createdAt: sec.entryDate ?? now,
        updatedAt: sec.entryDate ?? now,
      })
      .run();

    const assetKeys = extractAssetKeys(sec.body);
    for (const key of assetKeys) {
      db.insert(schema.asset)
        .values({
          id: generateId("ast"),
          entryId,
          storageKey: key,
          url: `/assets/${key}`,
          mimeType: key.endsWith(".png") ? "image/png" : "image/jpeg",
          createdAt: sec.entryDate ?? now,
        })
        .run();
    }
  }
}

// --- 导入 timeline.md（时间线，按事件拆分，type: letter） ---
const timelinePath = join(DATA, "diary", "timeline.md");
if (existsSync(timelinePath)) {
  const sections = splitBySections(readFileSync(timelinePath, "utf-8"));
  console.log(`→ timeline.md：${sections.length} 条时间线事件`);

  for (const sec of sections) {
    const entryId = generateId("ent");
    db.insert(schema.entry)
      .values({
        id: entryId,
        type: "letter",
        title: sec.title,
        body: sec.body,
        entryDate: sec.entryDate,
        createdAt: sec.entryDate ?? now,
        updatedAt: sec.entryDate ?? now,
      })
      .run();

    for (const key of extractAssetKeys(sec.body)) {
      db.insert(schema.asset)
        .values({
          id: generateId("ast"),
          entryId,
          storageKey: key,
          url: `/assets/${key}`,
          mimeType: key.endsWith(".png") ? "image/png" : "image/jpeg",
          createdAt: sec.entryDate ?? now,
        })
        .run();
    }
  }
}

// --- 导入 messages/留言板.md（整体一条记录） ---
const msgPath = join(DATA, "messages", "留言板.md");
if (existsSync(msgPath)) {
  const body = stripFrontmatter(readFileSync(msgPath, "utf-8"));
  const entryId = generateId("ent");
  db.insert(schema.entry)
    .values({
      id: entryId,
      type: "message",
      title: "留言板",
      body,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  for (const key of extractAssetKeys(body)) {
    db.insert(schema.asset)
      .values({
        id: generateId("ast"),
        entryId,
        storageKey: key,
        url: `/assets/${key}`,
        mimeType: key.endsWith(".png") ? "image/png" : "image/jpeg",
        createdAt: now,
      })
      .run();
  }
  console.log("→ 留言板.md：1 条记录");
}

// --- 导入 letters/信箱.md（整体一条记录） ---
const letterPath = join(DATA, "letters", "信箱.md");
if (existsSync(letterPath)) {
  const body = stripFrontmatter(readFileSync(letterPath, "utf-8"));
  const entryId = generateId("ent");
  db.insert(schema.entry)
    .values({
      id: entryId,
      type: "letter",
      title: "信箱",
      body,
      createdAt: now,
      updatedAt: now,
    })
    .run();

  for (const key of extractAssetKeys(body)) {
    db.insert(schema.asset)
      .values({
        id: generateId("ast"),
        entryId,
        storageKey: key,
        url: `/assets/${key}`,
        mimeType: key.endsWith(".png") ? "image/png" : "image/jpeg",
        createdAt: now,
      })
      .run();
  }
  console.log("→ 信箱.md：1 条记录");
}

// --- 导入 memo/*.md ---
const memoDir = join(DATA, "memo");
if (existsSync(memoDir)) {
  const memoFiles = readdirSync(memoDir).filter((f) => f.endsWith(".md"));
  for (const file of memoFiles) {
    const raw = readFileSync(join(memoDir, file), "utf-8");
    const body = stripFrontmatter(raw);
    const key = basename(file, ".md");
    db.insert(schema.memo)
      .values({
        id: generateId("mem"),
        key,
        title: key,
        body,
        updatedAt: now,
      })
      .run();
  }
  console.log(`→ memo/：${memoFiles.length} 条备忘录`);
}

// --- 初始化设置 ---
const defaultSettings = [
  { key: "anniversary_date", value: "20220519" },
  { key: "sunyuan_nickname", value: "小圆子" },
  { key: "linzhi_nickname", value: "小麟子" },
  { key: "theme", value: "light" },
];
for (const s of defaultSettings) {
  db.insert(schema.settings).values(s).run();
}
console.log("→ 初始化设置完成");

// --- 汇总 ---
const entryCnt = db.select().from(schema.entry).all().length;
const assetCnt = db.select().from(schema.asset).all().length;
const memoCnt = db.select().from(schema.memo).all().length;
console.log(`\n✓ 导入完成：${entryCnt} 条 entry，${assetCnt} 条 asset，${memoCnt} 条 memo`);
sqlite.close();
