import { createAuthClient } from "better-auth/react";
import { apiLogger } from "./logger";

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
  modifiedBy: string | null;
  body: string;
  entryDate: number | null;
  parentId: string | null;
  createdAt?: number;
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

export type CommentKind = "bottom" | "inline";
export type CommentTargetType = "entry" | "memo";

export interface CommentItem {
  id: string;
  targetType: CommentTargetType;
  targetId: string;
  kind: CommentKind;
  author: string | null;
  body: string;
  quote: string | null;
  anchorFrom: number | null;
  anchorTo: number | null;
  /** 选中文本前面最多 50 个字符（位置漂移后消歧用） */
  anchorPrefix: string | null;
  /** 选中文本后面最多 50 个字符（位置漂移后消歧用） */
  anchorSuffix: string | null;
  parentId: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface CommentGroups {
  bottom: CommentItem[];
  inline: CommentItem[];
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

/** 格式化 Unix 时间戳为 YYYY-MM-DD HH:mm（本地时区） */
export function formatDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const h = String(d.getHours()).padStart(2, "0");
  const min = String(d.getMinutes()).padStart(2, "0");
  return `${y}-${m}-${day} ${h}:${min}`;
}

/** 格式化 Unix 时间戳为中文日期（与 formatDate 同日界，用于标题区展示） */
export function formatDateCn(ts: number): string {
  const d = new Date(ts * 1000);
  const y = d.getUTCFullYear();
  const m = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return `${y}年${m}月${day}日`;
}

/** Whether updatedAt differs meaningfully from createdAt */
export function wasEdited(createdAt?: number, updatedAt?: number): boolean {
  if (createdAt == null || updatedAt == null) return false;
  return updatedAt - createdAt > 1;
}

/** Same local calendar day (for entryDate vs createdAt dedup) */
export function isSameLocalDay(a: number, b: number): boolean {
  const da = new Date(a * 1000);
  const db = new Date(b * 1000);
  return (
    da.getFullYear() === db.getFullYear() &&
    da.getMonth() === db.getMonth() &&
    da.getDate() === db.getDate()
  );
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
/** 文章保存时一并提交的边注位置重映射 */
export interface CommentPositionMapping {
  id: string;
  anchorFrom: number;
  anchorTo: number;
}

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
  const err = await parseApiError(res, fallback);
  if (import.meta.env.DEV && err.status && err.status >= 400) {
    apiLogger.warn("request failed", {
      status: err.status,
      message: err.message,
      url: res.url,
    });
  }
  throw err;
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
  data: {
    title?: string;
    body?: string;
    entryDate?: number;
    /** 边注位置重映射（文章编辑后同步更新） */
    commentMappings?: CommentPositionMapping[];
  }
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

export async function fetchComments(
  targetType: CommentTargetType,
  targetId: string
): Promise<CommentGroups> {
  const params = new URLSearchParams({ targetType, targetId });
  const res = await fetch(`${BASE}/api/comments?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "加载评论失败");
  return res.json();
}

export async function createComment(data: {
  targetType: CommentTargetType;
  targetId: string;
  kind: CommentKind;
  body: string;
  quote?: string;
  anchorFrom?: number;
  anchorTo?: number;
  anchorPrefix?: string;
  anchorSuffix?: string;
  parentId?: string | null;
}): Promise<{ id: string }> {
  const res = await fetch(`${BASE}/api/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "评论失败，请稍后重试");
  return res.json();
}

export async function updateComment(id: string, body: string): Promise<void> {
  const res = await fetch(`${BASE}/api/comments/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ body }),
  });
  await assertOk(res, "保存评论失败");
}

export async function deleteComment(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/comments/${encodeURIComponent(id)}`, {
    method: "DELETE",
    credentials: "include",
  });
  await assertOk(res, "删除评论失败");
}

export interface SpaceProfile {
  anniversaryDate: string | null;
  slogan: string | null;
  daysTogether: number | null;
}

export async function fetchSpace(): Promise<SpaceProfile> {
  const res = await fetch(`${BASE}/api/space`, { credentials: "include" });
  await assertOk(res, "加载空间档案失败");
  return res.json();
}

export async function updateSpace(data: {
  anniversaryDate?: string | null;
  slogan?: string | null;
}): Promise<SpaceProfile> {
  const res = await fetch(`${BASE}/api/space`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "保存空间档案失败");
  return res.json();
}

export const ACCENT_PRESETS = ["stone", "rose", "sage", "dusk"] as const;
export type AccentPreset = (typeof ACCENT_PRESETS)[number];

export interface AppSettings {
  accentPreset: AccentPreset;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE}/api/settings`, { credentials: "include" });
  await assertOk(res, "加载设置失败");
  return res.json();
}

export async function updateAppSettings(data: {
  accentPreset: AccentPreset;
}): Promise<AppSettings> {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "保存设置失败");
  return res.json();
}

export interface AuditLogItem {
  id: string;
  userId: string | null;
  author: string;
  action: string;
  resourceType: string;
  resourceId: string | null;
  metadata: Record<string, unknown> | null;
  requestId: string | null;
  createdAt: number;
}

export async function fetchAuditLogs(opts?: {
  limit?: number;
  offset?: number;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  since?: number;
}): Promise<{ items: AuditLogItem[]; total: number; limit: number; offset: number }> {
  const params = new URLSearchParams();
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  if (opts?.action) params.set("action", opts.action);
  if (opts?.resourceType) params.set("resourceType", opts.resourceType);
  if (opts?.resourceId) params.set("resourceId", opts.resourceId);
  if (opts?.since != null) params.set("since", String(opts.since));

  const query = params.toString();
  const res = await fetch(`${BASE}/api/audit${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  await assertOk(res, "加载审计日志失败");
  return res.json();
}

const DEFAULT_SPACE_TAGLINE = "两个人的时间轨道";

/** Sidebar tagline: days together, custom slogan, or default */
export function formatSpaceTagline(profile: SpaceProfile | null | undefined): string {
  if (!profile) return DEFAULT_SPACE_TAGLINE;
  if (profile.daysTogether != null && profile.daysTogether > 0) {
    return `在一起第 ${profile.daysTogether.toLocaleString("zh-CN")} 天`;
  }
  if (profile.slogan) return profile.slogan;
  return DEFAULT_SPACE_TAGLINE;
}

export function formatAnniversaryCn(isoDate: string): string {
  const [year, month, day] = isoDate.split("-").map(Number);
  return `${year}年${month}月${day}日`;
}

/** Client-side preview; mirrors server computeDaysTogether */
export function computeDaysTogetherFromIso(isoDate: string): number | null {
  const parts = isoDate.split("-").map(Number);
  if (parts.length !== 3 || parts.some((n) => Number.isNaN(n))) return null;
  const [year, month, day] = parts;
  const start = new Date(year, month - 1, day);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null;
  }
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (start > today) return null;
  const diffMs = today.getTime() - start.getTime();
  return Math.floor(diffMs / 86_400_000) + 1;
}
