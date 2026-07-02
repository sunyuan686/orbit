import { and, eq, isNull } from "drizzle-orm";
import { entry } from "../db/schema.js";
import { resolveAuthorFromOpenId, type FeishuConfigStored } from "./feishu-settings.js";
import {
  resolveCallbackEventType,
  type LarkInboundPayload,
} from "./feishu-webhook.js";

export type FeishuCallbackResponse = Record<string, unknown>;

interface FeishuCallbackContext {
  db: any;
  baseUrl: string;
  config: FeishuConfigStored;
}

interface OrbitCardAction {
  action: string;
  entryId?: string;
  contentType?: string;
  url?: string;
}

const CONTENT_TYPE_LABEL: Record<string, string> = {
  diary: "日记",
  timeline: "时间线",
  message: "留言",
  letter: "信",
  memo: "备忘",
};

function parseActionValue(value: unknown): OrbitCardAction | null {
  if (typeof value === "string") {
    try {
      return parseActionValue(JSON.parse(value));
    } catch {
      return value.startsWith("orbit:") ? { action: value } : null;
    }
  }
  if (!value || typeof value !== "object") return null;
  const record = value as Record<string, unknown>;
  const action =
    typeof record.action === "string"
      ? record.action
      : typeof record.orbit === "string"
        ? record.orbit
        : "";
  if (!action) return null;
  return {
    action,
    entryId: typeof record.entryId === "string" ? record.entryId : undefined,
    contentType:
      typeof record.contentType === "string" ? record.contentType : undefined,
    url: typeof record.url === "string" ? record.url : undefined,
  };
}

function toast(
  type: "info" | "success" | "error" | "warning",
  content: string
): FeishuCallbackResponse {
  return {
    toast: {
      type,
      content,
      i18n: { zh_cn: content },
    },
  };
}

function operatorOpenId(payload: LarkInboundPayload): string {
  const event = payload.event;
  const operator = event?.operator;
  if (operator && typeof operator === "object") {
    const openId = (operator as { open_id?: string }).open_id;
    if (typeof openId === "string") return openId.trim();
  }
  return typeof payload.open_id === "string" ? payload.open_id.trim() : "";
}

function isAuthorizedOperator(
  openId: string,
  config: FeishuConfigStored
): boolean {
  if (!openId) return false;
  return resolveAuthorFromOpenId(openId, config.authorOpenIds) !== null;
}

function extractAction(payload: LarkInboundPayload): OrbitCardAction | null {
  const event = payload.event;
  const eventAction = event?.action;
  if (eventAction && typeof eventAction === "object") {
    const value = (eventAction as { value?: unknown }).value;
    const parsed = parseActionValue(value);
    if (parsed) return parsed;
  }
  if (payload.action && typeof payload.action === "object") {
    const value = (payload.action as { value?: unknown }).value;
    return parseActionValue(value);
  }
  return null;
}

async function handleCardAction(
  payload: LarkInboundPayload,
  ctx: FeishuCallbackContext
): Promise<FeishuCallbackResponse> {
  const openId = operatorOpenId(payload);
  if (!isAuthorizedOperator(openId, ctx.config)) {
    return toast("error", "无权限操作");
  }

  const action = extractAction(payload);
  if (!action) return {};

  switch (action.action) {
    case "orbit:ack":
    case "orbit:open":
      return toast("success", "已收到");
    case "orbit:open_entry":
      if (action.entryId) {
        const segment = action.contentType || "diary";
        return toast("info", `打开 ${CONTENT_TYPE_LABEL[segment] ?? "内容"}`);
      }
      return toast("info", "请在浏览器中打开链接");
    default:
      return {};
  }
}

function normalizeBaseUrl(baseUrl: string): string {
  return baseUrl.replace(/\/$/, "");
}

function parseOrbitContentPath(
  url: string,
  baseUrl: string
): { id: string; contentType: string } | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const base = new URL(normalizeBaseUrl(baseUrl));
  if (parsed.origin !== base.origin) return null;

  const match = parsed.pathname.match(
    /^\/(diary|timeline|message|letter|memo)\/([^/]+)\/?$/
  );
  if (!match) return null;
  return { contentType: match[1], id: match[2] };
}

async function handleUrlPreviewGet(
  payload: LarkInboundPayload,
  ctx: FeishuCallbackContext
): Promise<FeishuCallbackResponse> {
  const event = payload.event;
  const context = event?.context;
  const url =
    context && typeof context === "object"
      ? (context as { url?: string }).url?.trim()
      : "";
  if (!url) return {};

  const parsed = parseOrbitContentPath(url, ctx.baseUrl);
  if (!parsed) {
    return {
      inline: {
        i18n_title: { zh_cn: "Orbit" },
        url: { copy_url: url, pc: url, web: url },
      },
    };
  }

  const row = await ctx.db
    .select({ title: entry.title, type: entry.type })
    .from(entry)
    .where(and(eq(entry.id, parsed.id), isNull(entry.deletedAt)))
    .get();

  const label = CONTENT_TYPE_LABEL[parsed.contentType] ?? "内容";
  const title = row?.title?.trim() || `Orbit · ${label}`;

  return {
    inline: {
      i18n_title: { zh_cn: title },
      url: { copy_url: url, pc: url, web: url },
    },
  };
}

function handleCardActionTriggerV1(
  payload: LarkInboundPayload,
  ctx: FeishuCallbackContext
): Promise<FeishuCallbackResponse> {
  return handleCardAction(payload, ctx);
}

export async function handleFeishuCallback(
  payload: LarkInboundPayload,
  ctx: FeishuCallbackContext
): Promise<FeishuCallbackResponse> {
  const eventType = resolveCallbackEventType(payload);

  switch (eventType) {
    case "url.preview.get":
      return handleUrlPreviewGet(payload, ctx);
    case "card.action.trigger":
      return handleCardAction(payload, ctx);
    case "card.action.trigger_v1":
      return handleCardActionTriggerV1(payload, ctx);
    default:
      return {};
  }
}
