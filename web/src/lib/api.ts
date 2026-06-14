import { createAuthClient } from "better-auth/client";

const BASE = "";

// better-auth 客户端（处理登录/登出/会话）
export const authClient = createAuthClient({
  baseURL: "http://localhost:3001",
});

export interface EntrySummary {
  id: string;
  type: string;
  title: string | null;
  entryDate: number | null;
}

export interface EntryDetail {
  id: string;
  type: string;
  title: string;
  body: string;
  entryDate: number | null;
  updatedAt?: number;
}

/** 类型 → 中文名 */
export const TYPE_LABEL: Record<string, string> = {
  diary: "日记",
  message: "留言板",
  letter: "信箱",
  memo: "备忘录",
};

/** 格式化 Unix 时间戳为 YYYY-MM-DD */
export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export async function fetchEntries(type: string): Promise<EntrySummary[]> {
  const res = await fetch(`${BASE}/api/articles?type=${type}`);
  if (!res.ok) throw new Error("fetch failed");
  return res.json();
}

export async function fetchEntry(id: string): Promise<EntryDetail> {
  const res = await fetch(`${BASE}/api/articles/${encodeURIComponent(id)}`);
  if (!res.ok) throw new Error("not found");
  return res.json();
}

export async function saveEntry(
  id: string,
  data: { title?: string; body?: string; entryDate?: number }
): Promise<void> {
  await fetch(`${BASE}/api/articles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
}

export async function createEntry(data: {
  type: string;
  title?: string;
  body?: string;
  entryDate?: number;
}): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/articles`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  return res.json();
}

export async function deleteEntry(id: string): Promise<void> {
  await fetch(`${BASE}/api/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
}

export async function uploadImage(
  file: File,
  entryId?: string
): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  if (entryId) form.append("entryId", entryId);
  const res = await fetch(`${BASE}/api/assets/upload`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const data = await res.json();
  return data.url as string;
}
