/**
 * 全文搜索服务（借鉴 Jant search.ts）
 *
 * - ≥3 字符：FTS5 trigram 前缀匹配
 * - <3 字符：LIKE 回退（适配中文双字词）
 */

import { sql } from "drizzle-orm";
import {
  buildSearchSnippet,
  decodeFtsSnippet,
  extractSearchTerms,
} from "../lib/search-snippet.js";

export interface SearchResult {
  id: string;
  type: string;
  title: string | null;
  author: string | null;
  entryDate: number | null;
  rank: number;
  snippet?: string;
}

export interface SearchOptions {
  limit?: number;
  offset?: number;
  type?: string;
}

type SearchDb = {
  all<T = Record<string, unknown>>(query: ReturnType<typeof sql>): T[] | Promise<T[]>;
};

interface RawSearchRow {
  id: string;
  type: string;
  title: string | null;
  author: string | null;
  entry_date: number | null;
  rank: number;
  snippet: string | null;
  body_text: string | null;
}

function buildSqliteFtsQuery(query: string): string | null {
  const terms = extractSearchTerms(query);
  if (terms.length === 0) return null;
  return terms.map((term) => `"${term.replace(/"/g, '""')}"*`).join(" ");
}

function mapRow(row: RawSearchRow, query: string): SearchResult {
  const snippet =
    decodeFtsSnippet(row.snippet) ??
    buildSearchSnippet([row.body_text, row.title], query);

  return {
    id: row.id,
    type: row.type,
    title: row.title,
    author: row.author || null,
    entryDate: row.entry_date,
    rank: row.rank,
    snippet,
  };
}

function withSnippetFallback(results: SearchResult[], query: string): SearchResult[] {
  return results.map((result) => {
    if (result.snippet) return result;
    const fallback = buildSearchSnippet([result.title], query);
    return fallback ? { ...result, snippet: fallback } : result;
  });
}

async function runAll<T>(db: SearchDb, query: ReturnType<typeof sql>): Promise<T[]> {
  const result = db.all<T>(query);
  return result instanceof Promise ? result : Promise.resolve(result);
}

export function createSearchService(db: SearchDb) {
  async function searchFts(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const ftsQuery = buildSqliteFtsQuery(query);
    if (!ftsQuery) return [];

    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const typeFilter = options.type && options.type !== "all" ? options.type : null;

    const entryTypeClause =
      typeFilter && typeFilter !== "memo" ? sql`AND entry.type = ${typeFilter}` : sql``;
    const includeEntry = !typeFilter || typeFilter !== "memo";
    const includeMemo = !typeFilter || typeFilter === "memo";

    const parts: ReturnType<typeof sql>[] = [];

    if (includeEntry) {
      parts.push(sql`
        SELECT
          entry.id,
          entry.type,
          entry.title,
          entry.author,
          entry.entry_date,
          entry.body_text,
          entry_fts.rank AS rank,
          snippet(entry_fts, 1, char(2), char(3), '...', 32) AS snippet
        FROM entry_fts
        JOIN entry ON entry.rowid = entry_fts.rowid
        WHERE entry_fts MATCH ${ftsQuery}
          AND entry.deleted_at IS NULL
          ${entryTypeClause}
      `);
    }

    if (includeMemo) {
      parts.push(sql`
        SELECT
          memo.id,
          'memo' AS type,
          memo.title,
          memo.author,
          memo.updated_at AS entry_date,
          memo.body AS body_text,
          memo_fts.rank AS rank,
          snippet(memo_fts, 1, char(2), char(3), '...', 32) AS snippet
        FROM memo_fts
        JOIN memo ON memo.rowid = memo_fts.rowid
        WHERE memo_fts MATCH ${ftsQuery}
          AND memo.deleted_at IS NULL
      `);
    }

    if (parts.length === 0) return [];

    const unionQuery =
      parts.length === 1
        ? sql`${parts[0]} ORDER BY rank LIMIT ${limit} OFFSET ${offset}`
        : sql`
            SELECT * FROM (
              ${sql.join(parts, sql` UNION ALL `)}
            )
            ORDER BY rank
            LIMIT ${limit} OFFSET ${offset}
          `;

    const rows = await runAll<RawSearchRow>(db, unionQuery);
    return withSnippetFallback(rows.map((row) => mapRow(row, query)), query);
  }

  async function searchLike(query: string, options: SearchOptions): Promise<SearchResult[]> {
    const limit = options.limit ?? 20;
    const offset = options.offset ?? 0;
    const like = `%${query}%`;
    const typeFilter = options.type && options.type !== "all" ? options.type : null;
    const includeEntry = !typeFilter || typeFilter !== "memo";
    const includeMemo = !typeFilter || typeFilter === "memo";

    const parts: ReturnType<typeof sql>[] = [];

    if (includeEntry) {
      const entryTypeClause =
        typeFilter && typeFilter !== "memo" ? sql`AND entry.type = ${typeFilter}` : sql``;
      parts.push(sql`
        SELECT
          entry.id,
          entry.type,
          entry.title,
          entry.author,
          entry.entry_date,
          entry.body_text,
          0 AS rank,
          NULL AS snippet
        FROM entry
        WHERE entry.deleted_at IS NULL
          ${entryTypeClause}
          AND (
            entry.title LIKE ${like}
            OR entry.body_text LIKE ${like}
            OR entry.author LIKE ${like}
          )
      `);
    }

    if (includeMemo) {
      parts.push(sql`
        SELECT
          memo.id,
          'memo' AS type,
          memo.title,
          memo.author,
          memo.updated_at AS entry_date,
          memo.body AS body_text,
          0 AS rank,
          NULL AS snippet
        FROM memo
        WHERE memo.deleted_at IS NULL
          AND (
            memo.title LIKE ${like}
            OR memo.body LIKE ${like}
            OR memo.author LIKE ${like}
          )
      `);
    }

    if (parts.length === 0) return [];

    const unionQuery =
      parts.length === 1
        ? sql`${parts[0]} ORDER BY entry_date DESC LIMIT ${limit} OFFSET ${offset}`
        : sql`
            SELECT * FROM (
              ${sql.join(parts, sql` UNION ALL `)}
            )
            ORDER BY entry_date DESC
            LIMIT ${limit} OFFSET ${offset}
          `;

    const rows = await runAll<RawSearchRow>(db, unionQuery);
    return withSnippetFallback(rows.map((row) => mapRow(row, query)), query);
  }

  return {
    async search(query: string, options: SearchOptions = {}): Promise<SearchResult[]> {
      const trimmed = query.trim();
      if (!trimmed) return [];

      const charCount = [...trimmed].length;
      if (charCount < 3) {
        return searchLike(trimmed, options);
      }

      const ftsResults = await searchFts(trimmed, options);
      if (ftsResults.length > 0) return ftsResults;

      return searchLike(trimmed, options);
    },
  };
}

export type SearchService = ReturnType<typeof createSearchService>;

export interface SearchIndexStatus {
  /** FTS 表与触发器是否已创建 */
  ftsReady: boolean;
  /** 索引条数与源表一致（可搜索） */
  inSync: boolean;
  entry: { active: number; indexed: number; missingBodyText: number };
  memo: { active: number; indexed: number };
  /** 同步维护，无后台任务；true 表示当前即可搜索 */
  indexingComplete: boolean;
}

interface CountRow {
  count: number;
}

async function countRows(db: SearchDb, query: ReturnType<typeof sql>): Promise<number> {
  const rows = await runAll<CountRow>(db, query);
  return rows[0]?.count ?? 0;
}

/** 检查 FTS 索引健康状态（同步索引，无「进行中」状态） */
export async function getSearchIndexStatus(db: SearchDb): Promise<SearchIndexStatus> {
  let ftsReady = false;
  let entryIndexed = 0;
  let memoIndexed = 0;

  try {
    const ftsTables = await runAll<{ name: string }>(
      db,
      sql`SELECT name FROM sqlite_master WHERE type = 'table' AND name IN ('entry_fts', 'memo_fts')`
    );
    ftsReady = ftsTables.length === 2;

    if (ftsReady) {
      entryIndexed = await countRows(db, sql`SELECT COUNT(*) AS count FROM entry_fts`);
      memoIndexed = await countRows(db, sql`SELECT COUNT(*) AS count FROM memo_fts`);
    }
  } catch {
    ftsReady = false;
  }

  const entryActive = await countRows(
    db,
    sql`SELECT COUNT(*) AS count FROM entry WHERE deleted_at IS NULL`
  );
  const entryTotal = await countRows(db, sql`SELECT COUNT(*) AS count FROM entry`);
  const entryMissingBodyText = await countRows(
    db,
    sql`
      SELECT COUNT(*) AS count FROM entry
      WHERE deleted_at IS NULL
        AND body IS NOT NULL AND body != ''
        AND (body_text IS NULL OR body_text = '')
    `
  );
  const memoActive = await countRows(
    db,
    sql`SELECT COUNT(*) AS count FROM memo WHERE deleted_at IS NULL`
  );
  const memoTotal = await countRows(db, sql`SELECT COUNT(*) AS count FROM memo`);

  const inSync = ftsReady && entryIndexed === entryTotal && memoIndexed === memoTotal;

  return {
    ftsReady,
    inSync,
    entry: { active: entryActive, indexed: entryIndexed, missingBodyText: entryMissingBodyText },
    memo: { active: memoActive, indexed: memoIndexed },
    indexingComplete: ftsReady && inSync,
  };
}
