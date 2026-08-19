import { generateText } from "ai";
import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { entry } from "../../db/schema.js";
import { toPlainText } from "../../lib/plain-text.js";
import { createSearchService } from "../content/search.js";
import { resolveModel, type AiRuntimeEnv } from "../ai/ai-model.js";

const BEIJING_OFFSET_SECONDS = 8 * 3600;

function beijingNowParts(): { year: number; month: number; day: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const beijing = new Date((nowSec + BEIJING_OFFSET_SECONDS) * 1000);
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
  };
}

function monthRange(year: number, month: number): { start: number; end: number } {
  const startBeijing = Date.UTC(year, month - 1, 1) / 1000 - BEIJING_OFFSET_SECONDS;
  const endBeijing =
    Date.UTC(year, month, 1) / 1000 - BEIJING_OFFSET_SECONDS;
  return { start: startBeijing, end: endBeijing };
}

export function weekRange(): { start: number; end: number } {
  const nowSec = Math.floor(Date.now() / 1000);
  const start = nowSec - 7 * 86400;
  return { start, end: nowSec + 1 };
}

export async function listEntriesInRange(
  db: any,
  range: { start: number; end: number },
  type?: string
): Promise<
  Array<{
    id: string;
    type: string;
    title: string | null;
    body: string | null;
    author: string;
    entryDate: number | null;
  }>
> {
  const conditions = [
    isNull(entry.deletedAt),
    gte(entry.entryDate, range.start),
    lt(entry.entryDate, range.end),
  ];
  if (type) {
    conditions.push(eq(entry.type, type));
  }
  return db
    .select({
      id: entry.id,
      type: entry.type,
      title: entry.title,
      body: entry.body,
      author: entry.author,
      entryDate: entry.entryDate,
    })
    .from(entry)
    .where(and(...conditions))
    .orderBy(desc(entry.entryDate), desc(entry.createdAt));
}

export function formatEntryListSummary(
  rows: Array<{
    id: string;
    type: string;
    body: string | null;
    author: string;
    entryDate: number | null;
  }>,
  baseUrl: string,
  label: string
): string {
  if (rows.length === 0) return `${label}暂无记录。`;
  const lines = rows.slice(0, 10).map((row) => {
    const plain = row.body ? toPlainText(row.body).slice(0, 80) : "（无正文）";
    const link = `${baseUrl.replace(/\/$/, "")}/${row.type}/${row.id}`;
    return `· ${row.author}：${plain}\n  ${link}`;
  });
  const suffix =
    rows.length > 10 ? `\n…共 ${rows.length} 条，仅展示前 10 条` : `\n共 ${rows.length} 条`;
  return `${label}\n${lines.join("\n")}${suffix}`;
}

export async function searchEntriesForFeishu(
  db: any,
  query: string,
  baseUrl: string
): Promise<string> {
  const trimmed = query.trim();
  if (!trimmed) return "请提供搜索关键词，例如：搜 旅行";
  const service = createSearchService(db);
  const results = await service.search(trimmed, { limit: 8 });
  if (results.length === 0) return `未找到与「${trimmed}」相关的内容。`;
  const lines = results.map((row) => {
    const snippet = row.snippet ?? row.title ?? "（无摘要）";
    const link = `${baseUrl.replace(/\/$/, "")}/${row.type}/${row.id}`;
    return `· [${row.type}] ${snippet}\n  ${link}`;
  });
  return `搜索「${trimmed}」\n${lines.join("\n")}`;
}

export async function buildMonthAiSummary(
  db: any,
  year: number,
  month: number,
  baseUrl: string,
  aiEnv?: AiRuntimeEnv
): Promise<string> {
  const range = monthRange(year, month);
  const rows = await listEntriesInRange(db, range);
  if (rows.length === 0) {
    return `${year}年${month}月暂无记录。`;
  }

  const corpus = rows
    .slice(0, 40)
    .map((row) => {
      const plain = row.body ? toPlainText(row.body).slice(0, 300) : "";
      return `[${row.type}] ${row.author}：${plain}`;
    })
    .join("\n\n");

  if (!aiEnv?.AI && !aiEnv?.CF_API_TOKEN) {
    return formatEntryListSummary(rows, baseUrl, `${year}年${month}月回顾`);
  }

  try {
    const { model } = await resolveModel(db, aiEnv);
    const { text } = await generateText({
      model,
      prompt: `你是情侣空间 Orbit 的助理。请根据以下${year}年${month}月的内容记录，写一段 200 字以内的温暖回顾摘要，中文，不要编造未出现的事实：\n\n${corpus}`,
    });
    return `${year}年${month}月 AI 回顾\n\n${text.trim()}`;
  } catch {
    return formatEntryListSummary(rows, baseUrl, `${year}年${month}月回顾（AI 暂不可用，改为列表）`);
  }
}

export function parseMonthArg(arg: string | undefined): { year: number; month: number } {
  const { year, month } = beijingNowParts();
  if (!arg?.trim()) return { year, month };
  const match = arg.trim().match(/^(\d{1,2})$/);
  if (match) {
    const m = Number(match[1]);
    if (m >= 1 && m <= 12) return { year, month: m };
  }
  const full = arg.trim().match(/^(\d{4})[-\/](\d{1,2})$/);
  if (full) {
    return { year: Number(full[1]), month: Number(full[2]) };
  }
  return { year, month };
}
