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
  userId?: string | null;
  entryDate: number | null;
  parentId: string | null;
  /** memo 稳定 slug；仅 type=memo 时有 */
  key?: string | null;
  /** 正文纯文本预览 */
  snippet?: string | null;
  /** 首图；无图为 null */
  coverUrl?: string | null;
}

export interface EntryListPage {
  items: EntrySummary[];
  total: number;
  limit: number;
  offset: number;
}

export interface EntryDetail {
  id: string;
  type: string;
  title: string | null;
  author: string | null;
  userId?: string | null;
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

const BEIJING_OFFSET_SECONDS = 8 * 3600;

export function beijingDateParts(ts: number): { y: number; m: number; day: number } {
  const d = new Date((ts + BEIJING_OFFSET_SECONDS) * 1000);
  return {
    y: d.getUTCFullYear(),
    m: d.getUTCMonth() + 1,
    day: d.getUTCDate(),
  };
}

/** 格式化 Unix 时间戳为 YYYY-MM-DD（北京时间日界） */
export function formatDate(ts: number): string {
  const { y, m, day } = beijingDateParts(ts);
  return `${y}-${String(m).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** 日记列表左栏：日 / 月 / 年（北京时间） */
export function formatDiaryDateParts(ts: number): {
  day: string;
  month: string;
  year: string;
} {
  const { y, m, day } = beijingDateParts(ts);
  return {
    day: String(day).padStart(2, "0"),
    month: `${m}月`,
    year: String(y),
  };
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

/** 格式化 Unix 时间戳为中文日期（北京时间日界，用于标题区展示） */
export function formatDateCn(ts: number): string {
  const { y, m, day } = beijingDateParts(ts);
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
  else if (res.status >= 500 && message === fallback) {
    message = "服务器错误，请稍后重试";
  }
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
): Promise<EntrySummary[]>;
export async function fetchEntries(
  type: string,
  opts: { roots?: boolean; limit: number; offset?: number }
): Promise<EntryListPage>;
export async function fetchEntries(
  type: string,
  opts?: { roots?: boolean; limit?: number; offset?: number }
): Promise<EntrySummary[] | EntryListPage> {
  const params = new URLSearchParams({ type });
  if (opts?.roots === false) params.set("roots", "0");
  if (opts?.limit != null) {
    params.set("limit", String(opts.limit));
    params.set("offset", String(opts.offset ?? 0));
  }
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
  parentId?: string | null;
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
  const { compressImage } = await import("./compressImage");
  const payload = await compressImage(file);
  const form = new FormData();
  form.append("file", payload);
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

export type GalleryFilter = "all" | "linked" | "orphan";

export interface GallerySource {
  type: string;
  id: string;
  title: string | null;
  entryDate: number | null;
  deleted: boolean;
}

export interface GalleryItem {
  storageKey: string;
  url: string;
  mimeType: string;
  size: number;
  uploadedAt: number;
  sortAt: number;
  linked: boolean;
  sources: GallerySource[];
}

export interface GalleryListResponse {
  items: GalleryItem[];
  total: number;
  limit: number;
  offset: number;
  filter: GalleryFilter;
}

export async function fetchGallery(opts?: {
  filter?: GalleryFilter;
  limit?: number;
  offset?: number;
}): Promise<GalleryListResponse> {
  const params = new URLSearchParams();
  if (opts?.filter) params.set("filter", opts.filter);
  if (opts?.limit != null) params.set("limit", String(opts.limit));
  if (opts?.offset != null) params.set("offset", String(opts.offset));
  const res = await fetch(`${BASE}/api/gallery?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "相册加载失败");
  return res.json();
}

export async function deleteGalleryImage(storageKey: string): Promise<void> {
  const res = await fetch(`${BASE}/api/gallery/${encodeURIComponent(storageKey)}`, {
    method: "DELETE",
    credentials: "include",
  });
  if (res.status === 400) {
    const data = (await res.json()) as { error?: string };
    throw new Error(data.error ?? "无法删除该图片");
  }
  await assertOk(res, "删除失败");
}

export function gallerySourceHref(source: GallerySource): string {
  if (source.type === "memo") return `/memo/${source.id}`;
  return `/${source.type}/${source.id}`;
}

export function gallerySourceLabel(source: GallerySource): string {
  const typeLabel = TYPE_LABEL[source.type] ?? source.type;
  const title = source.title?.trim();
  return title ? `${typeLabel} · ${title}` : typeLabel;
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

export interface SpaceAuthor {
  id: string;
  name: string;
}

export interface SpaceStatus {
  userCount: number;
  signupOpen: boolean;
  authors: SpaceAuthor[];
}

export async function fetchSpaceStatus(): Promise<SpaceStatus> {
  const res = await fetch(`${BASE}/api/space/status`);
  await assertOk(res, "加载空间状态失败");
  return res.json();
}

export async function updateProfile(name: string): Promise<{ name: string }> {
  const res = await fetch(`${BASE}/api/account/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  await assertOk(res, "更新爱称失败");
  return res.json();
}

export interface AccountBirthday {
  calendar: "solar" | "lunar";
  month: number;
  day: number;
  leapMonth: boolean;
  label: string;
}

export interface AccountProfile {
  name: string;
  birthday: AccountBirthday | null;
}

export async function fetchAccountProfile(): Promise<AccountProfile> {
  const res = await fetch(`${BASE}/api/account/profile`, {
    credentials: "include",
  });
  await assertOk(res, "加载个人资料失败");
  return res.json();
}

export async function updateAccountBirthday(
  birthday: Omit<AccountBirthday, "label"> | null
): Promise<AccountProfile> {
  const res = await fetch(`${BASE}/api/account/profile`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ birthday }),
  });
  await assertOk(res, "更新生日失败");
  return res.json();
}

export async function fetchInviteToken(
  token: string
): Promise<{ valid: boolean; reason?: string; inviterName?: string; expiresAt?: number }> {
  const res = await fetch(`${BASE}/api/invite/${encodeURIComponent(token)}`);
  if (res.status === 404 || res.status === 410) {
    return res.json();
  }
  await assertOk(res, "加载邀请失败");
  return res.json();
}

export async function acceptInvite(
  token: string,
  data: { email: string; password: string; displayName: string }
): Promise<void> {
  const res = await fetch(`${BASE}/api/invite/${encodeURIComponent(token)}/accept`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  await assertOk(res, "接受邀请失败");
}

export async function createInvite(): Promise<{ url: string; token: string; expiresAt: number }> {
  const res = await fetch(`${BASE}/api/invite`, {
    method: "POST",
    credentials: "include",
  });
  await assertOk(res, "生成邀请失败");
  return res.json();
}

export async function fetchActiveInvite(): Promise<{
  active: boolean;
  url?: string;
  expiresAt?: number;
}> {
  const res = await fetch(`${BASE}/api/invite`, { credentials: "include" });
  await assertOk(res, "加载邀请失败");
  return res.json();
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

export const AI_PROVIDERS = ["workers-ai", "deepseek", "custom"] as const;
export type AiProvider = (typeof AI_PROVIDERS)[number];

export const DEFAULT_WORKERS_AI_MODEL = "@cf/zai-org/glm-4.7-flash";
export const DEFAULT_DEEPSEEK_MODEL = "deepseek-v4-flash";

export const DEFAULT_ENABLED_AI_MODELS: readonly string[] = [
  `workers-ai:@cf/zai-org/glm-4.7-flash`,
  `workers-ai:@cf/meta/llama-3.3-70b-instruct-fp8-fast`,
  `workers-ai:@cf/openai/gpt-oss-20b`,
  `deepseek:${DEFAULT_DEEPSEEK_MODEL}`,
  `deepseek:deepseek-v4-pro`,
];

export const DEFAULT_ENABLED_AI_PROVIDERS: readonly AiProvider[] = [
  "workers-ai",
  "deepseek",
];

export interface AiConnectionModel {
  id: string;
  label?: string;
}

export interface AiCustomConnection {
  id: string;
  name: string;
  baseUrl: string;
  models: AiConnectionModel[];
  enabled: boolean;
}

export interface AiCustomConnectionPublic extends AiCustomConnection {
  hasApiKey: boolean;
}

export function inferAiProviderFromModelId(modelId: string): AiProvider {
  const trimmed = modelId.trim();
  if (trimmed.startsWith("custom:")) return "custom";
  if (trimmed.startsWith("workers-ai:") || trimmed.startsWith("@cf/")) {
    return "workers-ai";
  }
  return "deepseek";
}

export interface AppSettings {
  accentPreset: AccentPreset;
  aiProvider: AiProvider;
  aiModel: string;
  aiEnabledModels: string[];
  aiEnabledProviders: AiProvider[];
  aiConnections: AiCustomConnectionPublic[];
  hasDeepseekKey: boolean;
}

export async function fetchAppSettings(): Promise<AppSettings> {
  const res = await fetch(`${BASE}/api/settings`, { credentials: "include" });
  await assertOk(res, "加载设置失败");
  return res.json();
}

export async function updateAppSettings(data: {
  accentPreset?: AccentPreset;
  aiProvider?: AiProvider;
  aiModel?: string | null;
  aiEnabledModels?: string[];
  aiEnabledProviders?: AiProvider[];
  aiConnections?: AiCustomConnection[];
  connectionKey?: { id: string; key: string | null };
  deepseekKey?: string | null;
}): Promise<AppSettings> {
  const res = await fetch(`${BASE}/api/settings`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "保存设置失败");
  const next = (await res.json()) as AppSettings;

  // Provider catalog depends on keys/connections; enabled lists also change picker surface.
  if (
    data.deepseekKey !== undefined ||
    data.aiConnections !== undefined ||
    data.connectionKey !== undefined ||
    data.aiEnabledModels !== undefined ||
    data.aiEnabledProviders !== undefined
  ) {
    invalidateAiModelsCache();
  }

  return next;
}

export interface FeishuConfigPublic {
  enabled: boolean;
  appId: string;
  hasAppSecret: boolean;
  hasEncryptKey: boolean;
  verificationToken: string;
  authorOpenIds: Record<string, string>;
  defaultEntryType: "diary";
  allowedGroupChatIds: string[];
  mergeWindowMs: number;
  homeChatId: string;
  connectionStatus: "connected" | "misconfigured" | "disabled" | "verified";
  lastError: string | null;
  lastConnectedAt: number | null;
  webhookUrl: string;
  callbackUrl: string;
}

export async function fetchFeishuIntegration(): Promise<FeishuConfigPublic> {
  const res = await fetch(`${BASE}/api/integrations/feishu`, {
    credentials: "include",
  });
  await assertOk(res, "加载飞书配置失败");
  return res.json();
}

export async function updateFeishuIntegration(data: {
  enabled?: boolean;
  appId?: string;
  appSecret?: string | null;
  encryptKey?: string | null;
  verificationToken?: string;
  authorOpenIds?: Record<string, string>;
  allowedGroupChatIds?: string[];
  mergeWindowMs?: number;
  homeChatId?: string;
}): Promise<FeishuConfigPublic> {
  const res = await fetch(`${BASE}/api/integrations/feishu`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "保存飞书配置失败");
  return res.json();
}

export async function testFeishuIntegration(): Promise<{ ok: true }> {
  const res = await fetch(`${BASE}/api/integrations/feishu/test`, {
    method: "POST",
    credentials: "include",
  });
  await assertOk(res, "飞书连接测试失败");
  return res.json();
}

export interface ApiTokenListItem {
  id: string;
  name: string;
  tokenPrefix: string;
  author: string;
  createdAt: number;
  lastUsedAt: number | null;
}

export interface CreateApiTokenResult extends ApiTokenListItem {
  token: string;
}

export async function fetchApiTokens(): Promise<{ items: ApiTokenListItem[] }> {
  const res = await fetch(`${BASE}/api/api-tokens`, {
    credentials: "include",
  });
  await assertOk(res, "加载 API Token 失败");
  return res.json();
}

export async function createApiToken(name: string): Promise<CreateApiTokenResult> {
  const res = await fetch(`${BASE}/api/api-tokens`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ name }),
  });
  await assertOk(res, "创建 API Token 失败");
  return res.json();
}

export async function revokeApiToken(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/api-tokens/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await assertOk(res, "撤销 API Token 失败");
}

export type NotificationEventKind = "entry" | "comment" | "letter";

export interface NotificationChannelPrefs {
  inApp: boolean;
  feishu: boolean;
}

export interface NotificationPreferences {
  commentMergeMinutes: number;
  events: Record<NotificationEventKind, NotificationChannelPrefs>;
}

export interface NotificationItem {
  id: string;
  type: string;
  targetType: string;
  targetId: string;
  actor: string;
  title: string;
  body: string;
  link: string;
  readAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export async function fetchNotificationPreferences(): Promise<NotificationPreferences> {
  const res = await fetch(`${BASE}/api/notifications/preferences`, {
    credentials: "include",
  });
  await assertOk(res, "加载通知偏好失败");
  return res.json();
}

export async function updateNotificationPreferences(
  prefs: NotificationPreferences
): Promise<NotificationPreferences> {
  const res = await fetch(`${BASE}/api/notifications/preferences`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(prefs),
  });
  await assertOk(res, "保存通知偏好失败");
  return res.json();
}

export async function fetchNotificationUnreadCount(): Promise<{ count: number }> {
  const res = await fetch(`${BASE}/api/notifications/unread-count`, {
    credentials: "include",
  });
  await assertOk(res, "加载未读数失败");
  return res.json();
}

export async function fetchNotifications(): Promise<NotificationItem[]> {
  const res = await fetch(`${BASE}/api/notifications`, {
    credentials: "include",
  });
  await assertOk(res, "加载通知失败");
  return res.json();
}

export async function markNotificationRead(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/notifications/read/${id}`, {
    method: "PUT",
    credentials: "include",
  });
  await assertOk(res, "标记已读失败");
}

export async function markAllNotificationsRead(): Promise<void> {
  const res = await fetch(`${BASE}/api/notifications/read-all`, {
    method: "PUT",
    credentials: "include",
  });
  await assertOk(res, "全部已读失败");
}

export interface DeepseekModelOption {
  id: string;
  label: string;
  description: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  recommended?: boolean;
  legacy?: boolean;
}

export interface WorkersAiModelOption {
  id: string;
  label: string;
  description: string;
  task: string;
  contextWindow?: number;
  capabilities: string[];
  supportsToolCalling: boolean;
  recommended?: boolean;
}

export interface WorkersAiModelsResponse {
  models: WorkersAiModelOption[];
  source: "catalog" | "fallback";
}

const AI_MODELS_CACHE_TTL_MS = 10 * 60 * 1000;

type AiModelsCacheEntry<T> = {
  value: T;
  at: number;
};

let workersAiModelsCache: AiModelsCacheEntry<WorkersAiModelsResponse> | null = null;
let workersAiModelsInflight: Promise<WorkersAiModelsResponse> | null = null;
let deepseekModelsCache: AiModelsCacheEntry<DeepseekModelsResponse> | null = null;
let deepseekModelsInflight: Promise<DeepseekModelsResponse> | null = null;

function isFreshAiModelsCache<T>(
  entry: AiModelsCacheEntry<T> | null
): entry is AiModelsCacheEntry<T> {
  return entry !== null && Date.now() - entry.at < AI_MODELS_CACHE_TTL_MS;
}

export function peekWorkersAiModels(): WorkersAiModelsResponse | null {
  return isFreshAiModelsCache(workersAiModelsCache) ? workersAiModelsCache.value : null;
}

export function peekDeepseekModels(): DeepseekModelsResponse | null {
  return isFreshAiModelsCache(deepseekModelsCache) ? deepseekModelsCache.value : null;
}

export function invalidateAiModelsCache(): void {
  workersAiModelsCache = null;
  deepseekModelsCache = null;
  workersAiModelsInflight = null;
  deepseekModelsInflight = null;
}

export async function fetchWorkersAiModels(options?: {
  force?: boolean;
}): Promise<WorkersAiModelsResponse> {
  if (!options?.force && isFreshAiModelsCache(workersAiModelsCache)) {
    return workersAiModelsCache.value;
  }
  if (!options?.force && workersAiModelsInflight) {
    return workersAiModelsInflight;
  }

  const request = (async () => {
    const res = await fetch(`${BASE}/api/ai/workers-models`, {
      credentials: "include",
    });
    await assertOk(res, "加载 Workers AI 模型列表失败");
    const data = (await res.json()) as WorkersAiModelsResponse;
    workersAiModelsCache = { value: data, at: Date.now() };
    return data;
  })();

  workersAiModelsInflight = request;
  try {
    return await request;
  } finally {
    if (workersAiModelsInflight === request) {
      workersAiModelsInflight = null;
    }
  }
}

export interface DeepseekModelsResponse {
  models: DeepseekModelOption[];
  source: "api" | "fallback";
}

export async function fetchDeepseekModels(options?: {
  force?: boolean;
}): Promise<DeepseekModelsResponse> {
  if (!options?.force && isFreshAiModelsCache(deepseekModelsCache)) {
    return deepseekModelsCache.value;
  }
  if (!options?.force && deepseekModelsInflight) {
    return deepseekModelsInflight;
  }

  const request = (async () => {
    const res = await fetch(`${BASE}/api/ai/deepseek-models`, {
      credentials: "include",
    });
    await assertOk(res, "加载 DeepSeek 模型列表失败");
    const data = (await res.json()) as DeepseekModelsResponse;
    deepseekModelsCache = { value: data, at: Date.now() };
    return data;
  })();

  deepseekModelsInflight = request;
  try {
    return await request;
  } finally {
    if (deepseekModelsInflight === request) {
      deepseekModelsInflight = null;
    }
  }
}

export async function testDeepseekConnection(deepseekKey?: string): Promise<void> {
  const res = await fetch(`${BASE}/api/ai/deepseek-test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(deepseekKey?.trim() ? { deepseekKey } : {}),
  });
  await assertOk(res, "连接失败，请检查 API Key");
}

export async function testAiConnection(data: {
  baseUrl: string;
  apiKey?: string;
  connectionId?: string;
}): Promise<void> {
  const res = await fetch(`${BASE}/api/ai/connections/test`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "连接失败，请检查 Base URL 与 API Key");
}

export async function discoverAiConnectionModels(data: {
  baseUrl: string;
  apiKey?: string;
  connectionId?: string;
}): Promise<{ models: AiConnectionModel[] }> {
  const res = await fetch(`${BASE}/api/ai/connections/discover`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "拉取模型列表失败");
  return res.json();
}

export type AiContextMode = "global" | "article";

export interface AiConversationListItem {
  id: string;
  title: string;
  contextMode: AiContextMode;
  articleId?: string;
  shared: boolean;
  isOwner: boolean;
  ownerAuthor: string;
  updatedAt: number;
  preview: string;
}

export interface AiConversationDetail {
  id: string;
  title: string;
  contextMode: AiContextMode;
  articleId?: string;
  shared: boolean;
  isOwner: boolean;
  ownerAuthor: string;
  updatedAt: number;
  messages: Array<{
    id: string;
    role: string;
    parts: unknown[];
    metadata?: { author?: string };
  }>;
}

export async function fetchAiConversations(opts?: {
  articleId?: string;
}): Promise<{ items: AiConversationListItem[] }> {
  const params = new URLSearchParams();
  if (opts?.articleId) params.set("articleId", opts.articleId);
  const query = params.toString();
  const res = await fetch(`${BASE}/api/ai/conversations${query ? `?${query}` : ""}`, {
    credentials: "include",
  });
  await assertOk(res, "加载对话列表失败");
  return res.json();
}

export async function fetchAiConversation(id: string): Promise<AiConversationDetail> {
  const res = await fetch(`${BASE}/api/ai/conversations/${id}`, {
    credentials: "include",
  });
  await assertOk(res, "加载对话失败");
  return res.json();
}

export async function patchAiConversation(
  id: string,
  data: { title?: string; shared?: boolean }
): Promise<{ id: string; title: string; shared: boolean; updatedAt: number }> {
  const res = await fetch(`${BASE}/api/ai/conversations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(data),
  });
  await assertOk(res, "更新对话失败");
  return res.json();
}

export async function deleteAiConversation(id: string): Promise<void> {
  const res = await fetch(`${BASE}/api/ai/conversations/${id}`, {
    method: "DELETE",
    credentials: "include",
  });
  await assertOk(res, "删除对话失败");
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
  const startMs = Date.UTC(year, month - 1, day);
  if (
    new Date(startMs).getUTCFullYear() !== year ||
    new Date(startMs).getUTCMonth() !== month - 1 ||
    new Date(startMs).getUTCDate() !== day
  ) {
    return null;
  }

  const now = new Date();
  const todayIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const [todayYear, todayMonth, todayDay] = todayIso.split("-").map(Number);
  const todayMs = Date.UTC(todayYear, todayMonth - 1, todayDay);

  if (startMs > todayMs) return null;
  return Math.floor((todayMs - startMs) / 86_400_000) + 1;
}

export interface ActivityDayCount {
  date: string;
  count: number;
}

export interface ActivityStreak {
  current: number;
  longest: number;
}

export interface ActivitySummary {
  activeDays: number;
  totalEntries: number;
  rangeDays: number;
}

export interface ActivityStats {
  days: ActivityDayCount[];
  streak: ActivityStreak;
  summary: ActivitySummary;
}

export interface ActivityDayEntry {
  id: string;
  type: string;
  title: string | null;
  author: string;
  entryDate: number | null;
}

export async function fetchActivityStats(days = 365): Promise<ActivityStats> {
  const params = new URLSearchParams({ days: String(days) });
  const res = await fetch(`${BASE}/api/stats/activity?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "加载活动统计失败");
  return res.json();
}

export async function fetchActivityDayEntries(
  date: string
): Promise<{ date: string; entries: ActivityDayEntry[] }> {
  const params = new URLSearchParams({ date });
  const res = await fetch(`${BASE}/api/stats/activity?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "加载当日记录失败");
  return res.json();
}

export type MemoryWeight = 1 | 2 | 3;

export interface MemoryNode {
  id: string;
  sourceType: "entry";
  sourceId: string;
  contentType: string;
  occurredAt: number;
  title: string | null;
  snippet: string;
  coverImage: string | null;
  author: string;
  weight: MemoryWeight;
  parentId: string | null;
  link: string;
  x?: number;
  y?: number;
}

export interface MemorySummary {
  totalNodes: number;
  byType: Record<string, number>;
  milestoneCount: number;
  constellationCount?: number;
  recent: MemoryNode | null;
  latestMilestone?: MilestoneUnlock | null;
  daysTogether: number | null;
  anniversaryDate: string | null;
}

export interface MilestoneUnlock {
  key: string;
  title: string;
  description: string;
  category:
    | "relationship"
    | "creation"
    | "streak"
    | "gallery"
    | "constellation";
  unlockedAt: number;
  celebratedAt: number | null;
  isNew: boolean;
}

export interface MemoryNodesPage {
  nodes: MemoryNode[];
  total: number;
  limit: number;
  offset: number;
}

export interface MemoryThemeAlbum {
  key: string;
  title: string;
  count: number;
  nodes: MemoryNode[];
}

export async function fetchMemorySummary(): Promise<MemorySummary> {
  const res = await fetch(`${BASE}/api/memories/summary`, {
    credentials: "include",
  });
  await assertOk(res, "加载记忆摘要失败");
  return res.json();
}

export async function fetchMemoryNodes(options: {
  limit?: number;
  offset?: number;
  type?: string;
  year?: number;
  hasCover?: boolean;
} = {}): Promise<MemoryNodesPage> {
  const params = new URLSearchParams();
  if (options.limit != null) params.set("limit", String(options.limit));
  if (options.offset != null) params.set("offset", String(options.offset));
  if (options.type) params.set("type", options.type);
  if (options.year != null) params.set("year", String(options.year));
  if (options.hasCover) params.set("hasCover", "1");
  const qs = params.toString();
  const res = await fetch(`${BASE}/api/memories/nodes${qs ? `?${qs}` : ""}`, {
    credentials: "include",
  });
  await assertOk(res, "加载记忆节点失败");
  return res.json();
}

export async function fetchMemoryTimeline(
  limit = 200
): Promise<{
  total: number;
  width: number;
  height: number;
  nodes: MemoryNode[];
}> {
  const params = new URLSearchParams({ limit: String(limit) });
  const res = await fetch(`${BASE}/api/memories/timeline?${params}`, {
    credentials: "include",
  });
  await assertOk(res, "加载星图失败");
  return res.json();
}

export async function fetchMemoryMilestones(): Promise<{
  milestones: MilestoneUnlock[];
  newlyUnlocked?: string[];
}> {
  const res = await fetch(`${BASE}/api/memories/milestones`, {
    credentials: "include",
  });
  await assertOk(res, "加载里程碑失败");
  return res.json();
}

export async function celebrateMemoryMilestones(
  keys: string[]
): Promise<{ milestones: MilestoneUnlock[] }> {
  const res = await fetch(`${BASE}/api/memories/milestones/celebrate`, {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ keys }),
  });
  await assertOk(res, "标记里程碑失败");
  return res.json();
}

export async function fetchMemoryThemes(): Promise<{
  albums: MemoryThemeAlbum[];
}> {
  const res = await fetch(`${BASE}/api/memories/themes`, {
    credentials: "include",
  });
  await assertOk(res, "加载主题分册失败");
  return res.json();
}
