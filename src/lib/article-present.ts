import { loadUserNameMap, resolveUserName } from "../lib/author-present.js";

export async function presentEntrySummary(
  db: any,
  row: {
    id: string;
    type: string;
    title: string | null;
    author: string;
    userId: string | null;
    entryDate: number | null;
    createdAt: number;
    parentId: string | null;
  }
) {
  const map = await loadUserNameMap(db, [row.userId]);
  const authorName = resolveUserName(map, row.userId, row.author);
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    userId: row.userId,
    author: authorName,
    authorName,
    entryDate: row.entryDate,
    createdAt: row.createdAt,
    parentId: row.parentId,
  };
}

export async function presentEntryDetail(
  db: any,
  row: {
    id: string;
    type: string;
    title: string | null;
    author: string;
    userId: string | null;
    modifiedBy: string;
    modifiedByUserId: string | null;
    body: string | null;
    entryDate: number | null;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
  }
) {
  const map = await loadUserNameMap(db, [row.userId, row.modifiedByUserId]);
  const authorName = resolveUserName(map, row.userId, row.author);
  const modifiedByName = resolveUserName(
    map,
    row.modifiedByUserId,
    row.modifiedBy || row.author
  );
  return {
    id: row.id,
    type: row.type,
    title: row.title,
    userId: row.userId,
    author: authorName,
    authorName,
    modifiedByUserId: row.modifiedByUserId,
    modifiedBy: modifiedByName,
    modifiedByName,
    body: row.body ?? "",
    entryDate: row.entryDate,
    parentId: row.parentId,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}


export function authorWriteFields(session: { userId: string; author: string }) {
  return {
    userId: session.userId,
    author: session.author,
    modifiedByUserId: session.userId,
    modifiedBy: session.author,
  };
}

export function editorWriteFields(session: { userId: string; author: string }) {
  return {
    modifiedByUserId: session.userId,
    modifiedBy: session.author,
  };
}
