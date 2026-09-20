import { formatDate, type EntryDetail, type EntrySummary } from "./api";

export interface LetterThread {
  root: EntrySummary;
  replies: EntrySummary[];
}

/** 将平铺条目整理为主信 + 回信树（主信按 order 排序，默认降序） */
export function buildLetterTree(
  entries: EntrySummary[],
  order: "asc" | "desc" = "desc"
): LetterThread[] {
  const repliesByParent = new Map<string, EntrySummary[]>();
  const roots: EntrySummary[] = [];

  for (const e of entries) {
    if (e.parentId) {
      const list = repliesByParent.get(e.parentId) ?? [];
      list.push(e);
      repliesByParent.set(e.parentId, list);
    } else {
      roots.push(e);
    }
  }

  for (const [, replies] of repliesByParent) {
    replies.sort((a, b) => (a.entryDate ?? 0) - (b.entryDate ?? 0));
  }

  roots.sort((a, b) =>
    order === "asc"
      ? (a.entryDate ?? 0) - (b.entryDate ?? 0)
      : (b.entryDate ?? 0) - (a.entryDate ?? 0)
  );

  return roots.map((root) => ({
    root,
    replies: repliesByParent.get(root.id) ?? [],
  }));
}

export function getThreadRootId(
  entry: Pick<EntrySummary, "id" | "parentId">
): string {
  return entry.parentId ?? entry.id;
}

export function entryToSummary(entry: EntryDetail): EntrySummary {
  return {
    id: entry.id,
    type: entry.type,
    title: entry.title,
    author: entry.author,
    entryDate: entry.entryDate,
    parentId: entry.parentId,
  };
}

/** 主信 + 回信按日期升序（阅读时间线） */
export function buildThreadTimeline(
  root: EntrySummary,
  replies: EntrySummary[]
): EntrySummary[] {
  return [root, ...replies].sort(
    (a, b) => (a.entryDate ?? 0) - (b.entryDate ?? 0)
  );
}

export function entryDisplayLabel(entry: EntrySummary): string | null {
  const title = entry.title?.trim();
  if (title) return title;
  const snippet = entry.snippet?.trim();
  if (snippet) return `“${snippet}”`;
  return null;
}

export function formatReplyCount(count: number): string {
  return count === 1 ? "1 封回信" : `${count} 封回信`;
}

export function formatReplySummary(replies: EntrySummary[]): string {
  if (replies.length === 0) return "";
  const last = replies[replies.length - 1]!;
  const author = last.author ?? "对方";
  const date = last.entryDate ? formatDate(last.entryDate) : "";
  return `${formatReplyCount(replies.length)} · 最近 ${author}${date ? ` ${date}` : ""}`;
}
