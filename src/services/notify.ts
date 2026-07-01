import { and, desc, eq, gte, isNull } from "drizzle-orm";
import {
  CANONICAL_AUTHORS,
  type CanonicalAuthor,
} from "../authors.js";
import { notification } from "../db/schema.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  parseNotificationPreferences,
  NOTIFICATION_SETTING_KEY,
  type NotificationEventKind,
} from "./notification-settings.js";
import {
  loadFeishuRuntime,
  type FeishuAuthorOpenIds,
} from "./feishu-settings.js";
import {
  getTenantAccessToken,
  sendFeishuTextMessage,
} from "./feishu-api.js";
import { recordAudit } from "./audit.js";
import type { AiRuntimeEnv } from "./ai-model.js";

const FEISHU_MIN_INTERVAL_MS = 220;

let lastFeishuSendAt = 0;

export interface NotifyRuntime {
  baseUrl: string;
  secret: string;
  aiEnv?: AiRuntimeEnv;
}

export interface DispatchNotificationInput {
  kind: NotificationEventKind;
  actor: CanonicalAuthor;
  targetType: "entry" | "memo" | "comment";
  targetId: string;
  contentType?: string;
  title: string;
  body: string;
  link: string;
  requestId?: string | null;
}

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function generateId(prefix: string): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  const bytes = crypto.getRandomValues(new Uint8Array(10));
  let suffix = "";
  for (const byte of bytes) {
    suffix += chars[byte % chars.length];
  }
  return `${prefix}_${suffix}`;
}

export function getCounterpartAuthor(
  actor: CanonicalAuthor
): CanonicalAuthor {
  return actor === "小圆子" ? "小麟子" : "小圆子";
}

export function buildContentLink(
  baseUrl: string,
  contentType: string,
  id: string
): string {
  const root = baseUrl.replace(/\/$/, "");
  const segment =
    contentType === "memo" ? "memo" : contentType || "diary";
  return `${root}/${segment}/${id}`;
}

function notificationTypeForKind(kind: NotificationEventKind): string {
  if (kind === "comment") return "comment.create";
  if (kind === "letter") return "letter.reply";
  return "entry.create";
}

async function throttleFeishuSend(): Promise<void> {
  const elapsed = Date.now() - lastFeishuSendAt;
  if (elapsed < FEISHU_MIN_INTERVAL_MS) {
    await new Promise((resolve) =>
      setTimeout(resolve, FEISHU_MIN_INTERVAL_MS - elapsed)
    );
  }
  lastFeishuSendAt = Date.now();
}

async function sendFeishuNotification(
  db: any,
  secret: string,
  recipient: CanonicalAuthor,
  text: string,
  link: string
): Promise<{ ok: boolean; error?: string }> {
  const runtime = await loadFeishuRuntime(db, secret);
  if (!runtime.config.enabled || !runtime.config.appId || !runtime.secrets.appSecret) {
    return { ok: false, error: "feishu_disabled" };
  }

  const openId = runtime.config.authorOpenIds[recipient];
  const target = runtime.config.homeChatId.trim() || openId.trim();
  if (!target) {
    return { ok: false, error: "feishu_target_missing" };
  }

  try {
    await throttleFeishuSend();
    const token = await getTenantAccessToken(
      runtime.config.appId,
      runtime.secrets.appSecret
    );
    const receiveIdType = runtime.config.homeChatId.trim()
      ? "chat_id"
      : "open_id";
    await sendFeishuTextMessage(
      token,
      target,
      receiveIdType,
      `${text}\n${link}`
    );
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "feishu_send_failed",
    };
  }
}

async function findMergeableNotification(
  db: any,
  recipient: CanonicalAuthor,
  targetId: string,
  mergeMinutes: number
): Promise<{ id: string; body: string; payload: string | null } | null> {
  if (mergeMinutes <= 0) return null;
  const cutoff = now() - mergeMinutes * 60;
  const row = await db
    .select({
      id: notification.id,
      body: notification.body,
      payload: notification.payload,
    })
    .from(notification)
    .where(
      and(
        eq(notification.recipient, recipient),
        eq(notification.type, "comment.create"),
        eq(notification.targetId, targetId),
        isNull(notification.readAt),
        gte(notification.updatedAt, cutoff)
      )
    )
    .orderBy(desc(notification.updatedAt))
    .get();
  return row ?? null;
}

export async function dispatchNotification(
  db: any,
  runtime: NotifyRuntime,
  input: DispatchNotificationInput
): Promise<void> {
  if (!CANONICAL_AUTHORS.includes(input.actor)) return;

  const recipient = getCounterpartAuthor(input.actor);
  const settingsMap = await readSettingsMap(db);
  const prefs = parseNotificationPreferences(
    settingsMap[NOTIFICATION_SETTING_KEY]
  );
  const channels = prefs.events[input.kind];
  const type = notificationTypeForKind(input.kind);
  const timestamp = now();

  let notificationId: string | null = null;
  let inAppBody = input.body;

  if (channels.inApp) {
    if (input.kind === "comment") {
      const existing = await findMergeableNotification(
        db,
        recipient,
        input.targetId,
        prefs.commentMergeMinutes
      );
      if (existing) {
        let count = 1;
        try {
          const payload = existing.payload
            ? (JSON.parse(existing.payload) as { count?: number })
            : {};
          count = (payload.count ?? 1) + 1;
        } catch {
          count = 2;
        }
        inAppBody = `${input.actor} 等发表了 ${count} 条新评论`;
        await db
          .update(notification)
          .set({
            body: inAppBody,
            title: input.title,
            link: input.link,
            payload: JSON.stringify({ count, lastCommentId: input.targetId }),
            updatedAt: timestamp,
          })
          .where(eq(notification.id, existing.id));
        notificationId = existing.id;
      }
    }

    if (!notificationId) {
      notificationId = generateId("ntf");
      await db.insert(notification).values({
        id: notificationId,
        recipient,
        type,
        targetType: input.targetType,
        targetId: input.targetId,
        actor: input.actor,
        title: input.title,
        body: inAppBody,
        link: input.link,
        payload:
          input.kind === "comment"
            ? JSON.stringify({ count: 1, lastCommentId: input.targetId })
            : null,
        createdAt: timestamp,
        updatedAt: timestamp,
      });
    }
  }

  let feishuResult: { ok: boolean; error?: string } = {
    ok: false,
    error: "feishu_skipped",
  };
  if (channels.feishu) {
    feishuResult = await sendFeishuNotification(
      db,
      runtime.secret,
      recipient,
      `${input.title}\n${inAppBody}`,
      input.link
    );
  }

  await recordAudit(db, {
    author: input.actor,
    action: "notify.dispatch",
    resourceType: "notification",
    resourceId: notificationId,
    metadata: {
      kind: input.kind,
      recipient,
      inApp: channels.inApp,
      feishu: channels.feishu,
      feishuOk: feishuResult.ok,
      feishuError: feishuResult.error ?? null,
      targetType: input.targetType,
      targetId: input.targetId,
    },
    requestId: input.requestId ?? null,
  });
}

export function notifyEntryCreated(
  db: any,
  runtime: NotifyRuntime,
  input: {
    actor: CanonicalAuthor;
    entryId: string;
    entryType: string;
    parentId?: string | null;
    bodyPreview?: string;
    requestId?: string | null;
  }
): Promise<void> {
  const link = buildContentLink(runtime.baseUrl, input.entryType, input.entryId);
  const preview = input.bodyPreview?.slice(0, 80) ?? "新内容";
  const isReply =
    input.entryType === "letter" && Boolean(input.parentId);
  const kind: NotificationEventKind = isReply ? "letter" : "entry";
  const title = isReply
    ? `${input.actor} 回了新信`
    : `${input.actor} 发布了新${entryTypeLabel(input.entryType)}`;

  return dispatchNotification(db, runtime, {
    kind,
    actor: input.actor,
    targetType: "entry",
    targetId: input.entryId,
    contentType: input.entryType,
    title,
    body: preview,
    link,
    requestId: input.requestId,
  });
}

export function notifyCommentCreated(
  db: any,
  runtime: NotifyRuntime,
  input: {
    actor: CanonicalAuthor;
    commentId: string;
    targetType: "entry" | "memo";
    targetId: string;
    kind: "bottom" | "inline";
    body: string;
    contentType: string;
    requestId?: string | null;
  }
): Promise<void> {
  const link = buildContentLink(runtime.baseUrl, input.contentType, input.targetId);
  const label = input.kind === "inline" ? "边注" : "评论";
  return dispatchNotification(db, runtime, {
    kind: "comment",
    actor: input.actor,
    targetType: "comment",
    targetId: input.targetId,
    contentType: input.contentType,
    title: `${input.actor} 留了新${label}`,
    body: input.body.slice(0, 120),
    link,
    requestId: input.requestId,
  });
}

function entryTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    diary: "日记",
    timeline: "时间线",
    message: "留言",
    letter: "信",
    memo: "备忘录",
  };
  return labels[type] ?? "内容";
}

export function openIdForAuthor(
  mapping: FeishuAuthorOpenIds,
  author: CanonicalAuthor
): string {
  return mapping[author] ?? "";
}
