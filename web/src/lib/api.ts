import { createAuthClient } from "better-auth/react";

const BASE = "";

// better-auth 客户端（处理登录/登出/会话）
export const authClient = createAuthClient({
  baseURL: "",
});

export interface EntrySummary {
  id: string;
  type: string;
  title: string | null;
  author: string | null;
  entryDate: number | null;
  parentId: string | null;
}

export interface EntryDetail {
  id: string;
  type: string;
  title: string | null;
  author: string | null;
  body: string;
  entryDate: number | null;
  parentId: string | null;
  updatedAt?: number;
}

export interface SearchResult {
  id: string;
  type: string;
  title: string | null;
  author: string | null;
  entryDate: number | null;
  snippet?: string;
}

/** 类型 → 中文名 */
export const TYPE_LABEL: Record<string, string> = {
  diary: "日记",
  timeline: "时间线",
  message: "留言板",
  letter: "信箱",
  memo: "备忘录",
  // 兼容旧路径
  messages: "留言板",
  letters: "信箱",
};

/** 格式化 Unix 时间戳为 YYYY-MM-DD */
export function formatDate(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export class ApiError extends Error {
  status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export function getApiErrorMessage(err: unknown, fallback = "操作失败，请稍后重试"): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error && err.message) return err.message;
  return fallback;
}

/** 401 由路由守卫处理，不需要弹 toast */
export function shouldToastApiError(err: unknown): boolean {
  return !(err instanceof ApiError && err.status === 401);
}

async function parseApiError(res: Response, fallback: string): Promise<ApiError> {
  let message = fallback;
  try {
    const data = (await res.json()) as { error?: string };
    if (data.error === "Unauthorized") message = "请先登录后再操作";
    else if (typeof data.error === "string") message = data.error;
  } catch {
    // ignore parse errors
  }
  if (res.status === 401) message = "请先登录后再操作";
  else if (res.status >= 500) message = "服务器错误，请稍后重试";
  return new ApiError(message, res.status);
}

async function assertOk(res: Response, fallback: string): Promise<void> {
  if (res.ok) return;
  throw await parseApiError(res, fallback);
}

export async function fetchEntries(
  type: string,
  opts?: { roots?: boolean }
): Promise<EntrySummary[]> {
  const params = new URLSearchParams({ type });
  if (opts?.roots === false) params.set("roots", "0");
  const res = await fetch(`${BASE}/api/articles?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "加载列表失败");
  return res.json();
}

export async function fetchReplies(parentId: string): Promise<EntrySummary[]> {
  const res = await fetch(
    `${BASE}/api/articles/${encodeURIComponent(parentId)}/replies`,
    { credentials: "include" }
  );
  await assertOk(res, "加载回复失败");
  return res.json();
}

export async function fetchEntry(id: string): Promise<EntryDetail> {
  const res = await fetch(`${BASE}/api/articles/${encodeURIComponent(id)}`, {
    credentials: "include",
  });
  await assertOk(res, "内容不存在或加载失败");
  return res.json();
}

export async function saveEntry(
  id: string,
  data: { title?: string; body?: string; entryDate?: number }
): Promise<void> {
  const res = await fetch(`${BASE}/api/articles/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "保存失败，请稍后重试");
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
  await assertOk(res, "创建失败，请稍后重试");
  return res.json();
}

export async function deleteEntry(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/articles/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await assertOk(res, "删除失败，请稍后重试");
}

export async function fetchSearch(
  query: string,
  opts?: { type?: string; limit?: number; offset?: number }
): Promise<{ query: string; results: SearchResult[]; count: number }> {
  const params = new URLSearchParams({ q: query });
  if (opts?.type) params.set("type", opts.type);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));

  const res = await fetch(`${BASE}/api/search?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "搜索失败，请稍后重试");
  return res.json();
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
  await assertOk(res, "图片上传失败");
  const data = await res.json();
  return data.url as string;
}
