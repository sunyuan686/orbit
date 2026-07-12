import { and, desc, eq, gte, isNull } from "drizzle-orm";
import { notification } from "../db/schema.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  parseNotificationPreferences,
  NOTIFICATION_SETTING_KEY,
  type NotificationEventKind,
} from "./notification-settings.js";
import { loadFeishuRuntime } from "./feishu-settings.js";
import {
  getTenantAccessToken,
  sendFeishuTextMessage,
} from "./feishu-api.js";
import { recordAudit } from "./audit.js";
import type { AiRuntimeEnv } from "./ai-model.js";
import { getOtherUserId, getUserById } from "./space-authors.js";
import { loadUserNameMap, resolveUserName } from "../lib/author-present.js";
import { generateId } from "../lib/id.js";

const FEISHU_MIN_INTERVAL_MS = 220;

let lastFeishuSendAt = 0;

export interface NotifyRuntime {
  baseUrl: string;
  secret: string;
  aiEnv?: AiRuntimeEnv;
}

export interface DispatchNotificationInput {
  kind: NotificationEventKind;
  actorUserId: string;
  actorName: string;
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
  recipientUserId: string,
  text: string,
  link: string
): Promise<{ ok: boolean; error?: string }> {
  const runtime = await loadFeishuRuntime(db, secret);
  if (!runtime.config.enabled || !runtime.config.appId || !runtime.secrets.appSecret) {
    return { ok: false, error: "feishu_disabled" };
  }

  const openId = runtime.config.authorOpenIds[recipientUserId] ?? "";
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
  recipientUserId: string,
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
        eq(notification.recipientUserId, recipientUserId),
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
  const recipientUserId = await getOtherUserId(db, input.actorUserId);
  if (!recipientUserId) return;

  const nameMap = await loadUserNameMap(db, [
    input.actorUserId,
    recipientUserId,
  ]);
  const recipientName =
    resolveUserName(nameMap, recipientUserId) ?? "对方";

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
        recipientUserId,
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
        inAppBody = `${input.actorName} 等发表了 ${count} 条新评论`;
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
        recipient: recipientName,
        recipientUserId,
        type,
        targetType: input.targetType,
        targetId: input.targetId,
        actor: input.actorName,
        actorUserId: input.actorUserId,
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
      recipientUserId,
      `${input.title}\n${inAppBody}`,
      input.link
    );
  }

  await recordAudit(db, {
    userId: input.actorUserId,
    author: input.actorName,
    action: "notify.dispatch",
    resourceType: "notification",
    resourceId: notificationId,
    metadata: {
      kind: input.kind,
      recipientUserId,
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
    actorUserId: string;
    actorName: string;
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
    ? `${input.actorName} 回了新信`
    : `${input.actorName} 发布了新${entryTypeLabel(input.entryType)}`;

  return dispatchNotification(db, runtime, {
    kind,
    actorUserId: input.actorUserId,
    actorName: input.actorName,
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
    actorUserId: string;
    actorName: string;
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
    actorUserId: input.actorUserId,
    actorName: input.actorName,
    targetType: "comment",
    targetId: input.targetId,
    contentType: input.contentType,
    title: `${input.actorName} 留了新${label}`,
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

export async function resolveActorName(
  db: any,
  userId: string
): Promise<string> {
  const row = await getUserById(db, userId);
  return row?.name ?? "未知";
}
