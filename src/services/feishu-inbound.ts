import { and, desc, eq, gte, isNull, lt } from "drizzle-orm";
import { entry, asset } from "../db/schema.js";
import { toPlainText } from "../lib/plain-text.js";
import { generateId } from "../lib/id.js";
import {
  resolveUserIdFromOpenId,
  type FeishuConfigStored,
} from "./feishu-settings.js";
import { getUserById } from "./space-authors.js";
import {
  addFeishuReaction,
  createFeishuCardJson,
  downloadFeishuMessageImage,
  getTenantAccessToken,
  removeFeishuReaction,
  replyFeishuCardMessage,
  sendFeishuTextMessage,
} from "./feishu-api.js";
import {
  buildMonthAiSummary,
  formatEntryListSummary,
  listEntriesInRange,
  parseMonthArg,
  searchEntriesForFeishu,
  weekRange,
} from "./feishu-commands.js";
import { beijingDayRange as dayRange } from "./feishu-time.js";
import {
  notifyEntryCreated,
  type NotifyRuntime,
} from "./notify.js";
import type { AiRuntimeEnv } from "./ai-model.js";
import { syncAssetReferences } from "./asset-references.js";
import { handleFeishuAiChat } from "./feishu-ai-chat.js";
import { createLogger } from "../lib/logger.js";

const log = createLogger("feishu-inbound");

function now(): number {
  return Math.floor(Date.now() / 1000);
}

function textToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join("");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function appendHtmlBody(existing: string, addition: string): string {
  const trimmed = existing.trim();
  if (!trimmed) return addition;
  return `${trimmed}${addition}`;
}

async function sha256Prefix(body: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest("SHA-256", body);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 8);
}

function extensionForMime(mimeType: string): string {
  if (mimeType.includes("png")) return ".png";
  if (mimeType.includes("gif")) return ".gif";
  if (mimeType.includes("webp")) return ".webp";
  return ".jpg";
}

import {
  buildFeishuThreadKey,
  clearFeishuAiSession,
  interruptFeishuAiThread,
  isFeishuChatResetCommand,
  isThreadBusy,
} from "./feishu-ai-chat.js";
import {
  normalizeFeishuMentions,
  buildFeishuAgentUserText,
  type FeishuInboundMention,
} from "./feishu-message-content.js";

export interface FeishuInboundMessage {
  messageId: string;
  chatId: string;
  threadId?: string;
  chatType: "p2p" | "group" | string;
  messageType: string;
  content: string;
  senderOpenId: string;
  mentions?: FeishuInboundMention[];
  botOpenId?: string;
}

export interface FeishuInboundContext {
  db: any;
  config: FeishuConfigStored;
  appId: string;
  appSecret: string;
  baseUrl: string;
  notifyRuntime: NotifyRuntime;
  aiEnv?: AiRuntimeEnv;
  saveAsset: (input: {
    filename: string;
    mimeType: string;
    body: ArrayBuffer;
  }) => Promise<string>;
}

interface ParsedWrite {
  entryType: string;
  entryDate: number;
  text: string;
}

function extractTextFromContent(messageType: string, content: string): string {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    if (messageType === "text" && typeof parsed.text === "string") {
      return parsed.text.trim();
    }
    if (messageType === "post" && parsed.content) {
      return extractPostText(parsed.content).trim();
    }
  } catch {
    return content.trim();
  }
  return "";
}

function extractPostText(content: unknown): string {
  if (!Array.isArray(content)) return "";
  const lines: string[] = [];
  for (const paragraph of content) {
    if (!Array.isArray(paragraph)) continue;
    for (const node of paragraph) {
      if (
        node &&
        typeof node === "object" &&
        "text" in node &&
        typeof (node as { text?: string }).text === "string"
      ) {
        lines.push((node as { text: string }).text);
      }
    }
  }
  return lines.join("\n");
}

function extractImageKey(messageType: string, content: string): string | null {
  if (messageType !== "image") return null;
  try {
    const parsed = JSON.parse(content) as { image_key?: string };
    return typeof parsed.image_key === "string" ? parsed.image_key : null;
  } catch {
    return null;
  }
}

function isQueryCommand(text: string): boolean {
  const trimmed = text.trim();
  if (isFeishuChatResetCommand(trimmed)) {
    return true;
  }
  if (
    trimmed.startsWith("/today") ||
    trimmed.startsWith("/week") ||
    trimmed.startsWith("/month") ||
    trimmed.startsWith("/summary") ||
    trimmed.startsWith("/clear") ||
    trimmed.startsWith("/reset") ||
    trimmed.startsWith("/搜") ||
    trimmed.startsWith("搜") ||
    trimmed.startsWith("查")
  ) {
    return true;
  }
  return false;
}

function parseWriteCommand(raw: string, defaultType: string): ParsedWrite | null {
  const text = raw.trim();
  if (!text) return null;

  // 1. /日记 内容
  if (text.startsWith("/日记")) {
    const body = text.replace(/^\/日记\s*/, "").trim();
    if (!body) return null;
    return { entryType: "diary", entryDate: now(), text: body };
  }

  // 2. /留言 内容
  if (text.startsWith("/留言")) {
    const body = text.replace(/^\/留言\s*/, "").trim();
    if (!body) return null;
    return { entryType: "message", entryDate: now(), text: body };
  }

  // 3. /信 内容
  if (text.startsWith("/信")) {
    const body = text.replace(/^\/信\s*/, "").trim();
    if (!body) return null;
    return { entryType: "letter", entryDate: now(), text: body };
  }

  // 4. /补记 M/D 内容
  const backdate = text.match(
    /^\/补记\s*(\d{1,2})[\/\-.](\d{1,2})[：:\s]*([\s\S]+)$/
  );
  if (backdate) {
    const month = Number(backdate[1]);
    const day = Number(backdate[2]);
    const body = backdate[3].trim();
    if (!body) return null;
    const entryDate = beijingDateToUnix(month, day);
    if (!entryDate) return null;
    return { entryType: "diary", entryDate, text: body };
  }

  return null;
}

function beijingDateToUnix(month: number, day: number): number | null {
  const { year } = beijingNowParts();
  const BEIJING_OFFSET = 8 * 3600;
  const ms = Date.UTC(year, month - 1, day);
  const date = new Date(ms);
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
    return null;
  }
  return Math.floor(ms / 1000) - BEIJING_OFFSET;
}

function beijingNowParts(): { year: number; month: number; day: number } {
  const nowSec = now();
  const beijing = new Date((nowSec + 8 * 3600) * 1000);
  return {
    year: beijing.getUTCFullYear(),
    month: beijing.getUTCMonth() + 1,
    day: beijing.getUTCDate(),
  };
}

async function replyText(
  ctx: FeishuInboundContext,
  message: FeishuInboundMessage,
  text: string
): Promise<void> {
  const token = await getTenantAccessToken(ctx.appId, ctx.appSecret);
  await sendFeishuTextMessage(token, message.chatId, "chat_id", text);
}

async function handleQueryCommand(
  ctx: FeishuInboundContext,
  message: FeishuInboundMessage,
  text: string
): Promise<void> {
  const trimmed = text.trim();
  const baseUrl = ctx.baseUrl;

  if (isFeishuChatResetCommand(trimmed)) {
    const threadKey = buildFeishuThreadKey(message, message.senderOpenId);
    interruptFeishuAiThread(threadKey);
    await clearFeishuAiSession(ctx.db, threadKey);
    await replyText(ctx, message, "已中断当前处理并清空对话 🗑️");
    return;
  }

  if (trimmed.toLowerCase() === "/today") {
    const { start, end } = dayRange();
    const rows = await listEntriesInRange(ctx.db, { start, end }, "diary");
    await replyText(
      ctx,
      message,
      formatEntryListSummary(rows, baseUrl, "今日日记")
    );
    return;
  }

  if (trimmed.toLowerCase().startsWith("/week")) {
    const rows = await listEntriesInRange(ctx.db, weekRange());
    await replyText(
      ctx,
      message,
      formatEntryListSummary(rows, baseUrl, "近 7 天")
    );
    return;
  }

  if (trimmed.toLowerCase().startsWith("/month")) {
    const arg = trimmed.slice("/month".length).trim();
    const { year, month } = parseMonthArg(arg);
    const start = Date.UTC(year, month - 1, 1) / 1000 - 8 * 3600;
    const end = Date.UTC(year, month, 1) / 1000 - 8 * 3600;
    const rows = await listEntriesInRange(ctx.db, { start, end });
    await replyText(
      ctx,
      message,
      formatEntryListSummary(rows, baseUrl, `${year}年${month}月`)
    );
    return;
  }

  if (trimmed.toLowerCase().startsWith("/summary")) {
    const arg = trimmed.slice("/summary".length).trim();
    const { year, month } = parseMonthArg(
      arg.replace(/月$/, "").replace(/^(\d{1,2})$/, "$1")
    );
    const summary = await buildMonthAiSummary(
      ctx.db,
      year,
      month,
      baseUrl,
      ctx.aiEnv
    );
    await replyText(ctx, message, summary);
    return;
  }

  const searchMatch =
    trimmed.match(/^\/搜\s+(.+)$/i) ??
    trimmed.match(/^搜[：:\s]+(.+)$/) ??
    trimmed.match(/^查[：:\s]+(.+)$/);
  if (searchMatch) {
    const result = await searchEntriesForFeishu(
      ctx.db,
      searchMatch[1],
      baseUrl
    );
    await replyText(ctx, message, result);
    return;
  }

  const command = trimmed.split(/\s+/)[0]?.toLowerCase() ?? "";
  await replyText(ctx, message, `暂不支持指令：${command}`);
}

async function findMergeTarget(
  db: any,
  userId: string,
  entryType: string,
  mergeWindowMs: number
): Promise<{ id: string; body: string | null; updatedAt: number } | null> {
  if (mergeWindowMs <= 0 || entryType !== "diary") return null;
  const { start, end } = dayRange();
  const cutoff = now() - Math.ceil(mergeWindowMs / 1000);
  const row = await db
    .select({
      id: entry.id,
      body: entry.body,
      updatedAt: entry.updatedAt,
    })
    .from(entry)
    .where(
      and(
        eq(entry.type, entryType),
        eq(entry.userId, userId),
        isNull(entry.deletedAt),
        gte(entry.entryDate, start),
        lt(entry.entryDate, end),
        gte(entry.updatedAt, cutoff)
      )
    )
    .orderBy(desc(entry.updatedAt))
    .get();
  return row ?? null;
}

interface InboundActor {
  userId: string;
  name: string;
}

async function writeEntryText(
  ctx: FeishuInboundContext,
  actor: InboundActor,
  parsed: ParsedWrite
): Promise<string> {
  const html = textToHtml(parsed.text);
  const mergeTarget = await findMergeTarget(
    ctx.db,
    actor.userId,
    parsed.entryType,
    ctx.config.mergeWindowMs
  );
  const timestamp = now();

  if (mergeTarget) {
    const nextBody = appendHtmlBody(mergeTarget.body ?? "", html);
    await ctx.db
      .update(entry)
      .set({
        body: nextBody,
        bodyText: toPlainText(nextBody),
        modifiedByUserId: actor.userId,
        modifiedBy: actor.name,
        updatedAt: timestamp,
      })
      .where(eq(entry.id, mergeTarget.id));
    await syncAssetReferences(ctx.db, parsed.entryType, mergeTarget.id, nextBody);
    log.info("merged feishu entry text into existing entry", {
      entryId: mergeTarget.id,
      entryType: parsed.entryType,
      userId: actor.userId,
      author: actor.name,
      textPreview: parsed.text.slice(0, 50),
    });
    return mergeTarget.id;
  }

  const id = generateId("ent");
  await ctx.db.insert(entry).values({
    id,
    type: parsed.entryType,
    userId: actor.userId,
    author: actor.name,
    modifiedByUserId: actor.userId,
    modifiedBy: actor.name,
    body: html,
    bodyText: toPlainText(html),
    entryDate: parsed.entryDate,
    createdAt: timestamp,
    updatedAt: timestamp,
  });
  await syncAssetReferences(ctx.db, parsed.entryType, id, html);
  log.info("created new feishu entry from text", {
    entryId: id,
    entryType: parsed.entryType,
    userId: actor.userId,
    author: actor.name,
    textPreview: parsed.text.slice(0, 50),
  });

  void notifyEntryCreated(ctx.db, ctx.notifyRuntime, {
    actorUserId: actor.userId,
    actorName: actor.name,
    entryId: id,
    entryType: parsed.entryType,
    bodyPreview: parsed.text,
  }).catch(() => undefined);

  return id;
}

async function attachImageToEntry(
  ctx: FeishuInboundContext,
  entryId: string,
  message: FeishuInboundMessage,
  imageKey: string
): Promise<void> {
  const token = await getTenantAccessToken(ctx.appId, ctx.appSecret);
  const { body, mimeType } = await downloadFeishuMessageImage(
    token,
    message.messageId,
    imageKey
  );
  const ext = extensionForMime(mimeType);
  const filename = `${await sha256Prefix(body)}${ext}`;
  const url = await ctx.saveAsset({ filename, mimeType, body });
  const imgHtml = `<img src="${url}" alt="飞书图片" class="orbit-prose-img" />`;

  const row = await ctx.db
    .select({ body: entry.body, type: entry.type })
    .from(entry)
    .where(eq(entry.id, entryId))
    .get();
  const nextBody = appendHtmlBody(row?.body ?? "", imgHtml);
  await ctx.db
    .update(entry)
    .set({
      body: nextBody,
      bodyText: toPlainText(nextBody),
      updatedAt: now(),
    })
    .where(eq(entry.id, entryId));
  if (row?.type) {
    await syncAssetReferences(ctx.db, row.type, entryId, nextBody);
  }

  const existingAsset = await ctx.db
    .select({ id: asset.id })
    .from(asset)
    .where(eq(asset.storageKey, filename))
    .get();
  if (!existingAsset) {
    await ctx.db.insert(asset).values({
      id: generateId("ast"),
      entryId,
      storageKey: filename,
      mimeType,
      size: body.byteLength,
      createdAt: now(),
    });
  }

  log.info("attached feishu image asset to entry", {
    entryId,
    storageKey: filename,
    mimeType,
    size: body.byteLength,
    messageId: message.messageId,
  });
}



export async function processFeishuInboundMessage(
  ctx: FeishuInboundContext,
  message: FeishuInboundMessage,
  options: { hasGroupMention: boolean }
): Promise<void> {
  log.info("processing feishu inbound message", {
    messageId: message.messageId,
    chatId: message.chatId,
    senderOpenId: message.senderOpenId,
    chatType: message.chatType,
    messageType: message.messageType,
  });

  const actor = await resolveActorFromMapping(
    ctx.db,
    message.senderOpenId,
    ctx.config.authorOpenIds
  );
  if (!actor) {
    log.warn("feishu inbound message rejected: sender open_id not mapped to actor", {
      senderOpenId: message.senderOpenId,
      messageId: message.messageId,
    });
    await replyText(ctx, message, "未授权：请先在 Orbit 设置页绑定你的飞书 open_id。");
    return;
  }

  log.info("feishu sender resolved to actor", {
    senderOpenId: message.senderOpenId,
    userId: actor.userId,
    userName: actor.name,
  });

  const threadKey = buildFeishuThreadKey(message, actor.userId);
  const isQueued = isThreadBusy(threadKey);
  const initialEmoji = isQueued ? "THINKING" : "Typing";

  const typingReactionPromise = getTenantAccessToken(ctx.appId, ctx.appSecret).then((token) => {
    return addFeishuReaction(token, message.messageId, initialEmoji);
  }).catch(() => null);

  if (message.chatType === "group") {
    // 1. 群聊中必须 @Bot 机器人
    if (!options.hasGroupMention) {
      log.info("ignoring feishu group message without bot mention", {
        chatId: message.chatId,
        messageId: message.messageId,
      });
      return;
    }
    // 2. 如果配置了特定的白名单群 ID，且当前群不在白名单内，则拦截
    if (
      ctx.config.allowedGroupChatIds.length > 0 &&
      !ctx.config.allowedGroupChatIds.includes(message.chatId)
    ) {
      log.info("ignoring feishu group message (group chatId not allowed)", {
        chatId: message.chatId,
        allowedGroupChatIds: ctx.config.allowedGroupChatIds,
        messageId: message.messageId,
      });
      return;
    }
  }

  const rawText = extractTextFromContent(message.messageType, message.content);
  const text = normalizeFeishuMentions(
    rawText,
    message.mentions ?? [],
    message.botOpenId
  );
  const imageKey = extractImageKey(message.messageType, message.content);

  // 1. 查询类指令（/today, /week, /month, /summary, /clear, /reset, /搜）
  if (text && isQueryCommand(text)) {
    log.info("executing feishu query command", {
      command: text,
      messageId: message.messageId,
      actorName: actor.name,
    });
    await handleQueryCommand(ctx, message, text);
    void typingReactionPromise.then(async (typingReactionId) => {
      const token = await getTenantAccessToken(ctx.appId, ctx.appSecret);
      if (typingReactionId) {
        await removeFeishuReaction(token, message.messageId, typingReactionId).catch(() => {});
      }
      await addFeishuReaction(token, message.messageId, "DONE").catch(() => {});
    }).catch(() => {});
    return;
  }

  // 2. 显式写入类指令（/日记, /留言, /信, /补记）
  const parsedWrite = text ? parseWriteCommand(text, ctx.config.defaultEntryType) : null;

  let entryId: string | null = null;
  if (parsedWrite) {
    entryId = await writeEntryText(ctx, actor, parsedWrite);
  } else if (imageKey) {
    // 带有图片的消息直接录入为日志/图片附件
    entryId = await writeEntryText(ctx, actor, {
      entryType: ctx.config.defaultEntryType,
      entryDate: now(),
      text: text || "（飞书图片）",
    });
  }

  if (entryId && imageKey) {
    await attachImageToEntry(ctx, entryId, message, imageKey);
  }

  if (entryId) {
    log.info("feishu entry written successfully", {
      entryId,
      messageId: message.messageId,
      actorName: actor.name,
      hasImage: Boolean(imageKey),
    });
    const token = await getTenantAccessToken(ctx.appId, ctx.appSecret);

    // ⚡️ 核心体验升级 1：取消 Typing/THINKING 表情，贴上绿色 DONE 表情！
    void typingReactionPromise.then(async (typingReactionId) => {
      if (typingReactionId) {
        await removeFeishuReaction(token, message.messageId, typingReactionId).catch(() => {});
      }
      await addFeishuReaction(token, message.messageId, "DONE").catch(() => {});
    }).catch(() => {});

    // ⚡️ 核心体验升级 2：发送带跳转链接的精美交互式卡片！
    const labels: Record<string, string> = {
      diary: "日记",
      message: "留言",
      letter: "信",
    };
    const row = await ctx.db
      .select({ type: entry.type })
      .from(entry)
      .where(eq(entry.id, entryId))
      .get();
    const entryType = row?.type ?? "diary";
    const label = labels[entryType] ?? "内容";
    const entryUrl = `${ctx.baseUrl.replace(/\/$/, "")}/${entryType}/${entryId}`;
    const textPreview = (text || "（飞书附件/内容）").trim().slice(0, 100);

    const cardJson = {
      schema: "2.0",
      header: {
        title: { content: `已成功记入${label} ✨`, tag: "plain_text" },
        template: "green"
      },
      body: {
        elements: [
          {
            tag: "markdown",
            content: `📝 **内容已记录至 Orbit 空间**\n\n> ${textPreview}\n\n🔗 [**点击在 Orbit 中查看记录 ➔**](${entryUrl})`
          }
        ]
      }
    };

    try {
      const cardId = await createFeishuCardJson(token, cardJson);
      await replyFeishuCardMessage(
        token,
        message.messageId,
        cardId,
        Boolean(ctx.config.replyInThread)
      );
    } catch (err) {
      log.error("[Feishu Inbound] Send entry card failed, falling back to text", err);
      await replyText(ctx, message, `已记入${label} ✅\n🔗 查看记录: ${entryUrl}`);
    }
    return;
  }

  // 3. 无 / 前缀的自然语言文本 → 进入 AI 多轮对话！
  if (text) {
    const agentText = buildFeishuAgentUserText({
      text,
      chatType: message.chatType,
      speakerName: actor.name,
      speakerOpenId: message.senderOpenId,
    });
    log.info("dispatching feishu message to AI chat", {
      messageId: message.messageId,
      chatId: message.chatId,
      threadId: message.threadId ?? "",
      textPreview: agentText.slice(0, 60),
      actorName: actor.name,
      isQueued,
    });
    await handleFeishuAiChat(
      {
        db: ctx.db,
        appId: ctx.appId,
        appSecret: ctx.appSecret,
        baseUrl: ctx.baseUrl,
        aiEnv: ctx.aiEnv,
        aiResponseTimeoutMs: ctx.config.aiResponseTimeoutMs,
      },
      {
        messageId: message.messageId,
        chatId: message.chatId,
        threadId: message.threadId ?? "",
        chatType: message.chatType,
        senderOpenId: message.senderOpenId,
        replyInThread: ctx.config.replyInThread,
        isQueued,
        typingReactionPromise,
      },
      agentText,
      actor
    );
  }
}

function resolveAuthorFromMapping(
  openId: string,
  mapping: FeishuConfigStored["authorOpenIds"]
): string | null {
  return resolveUserIdFromOpenId(openId, mapping);
}

async function resolveActorFromMapping(
  db: any,
  openId: string,
  mapping: FeishuConfigStored["authorOpenIds"]
): Promise<InboundActor | null> {
  const userId = resolveUserIdFromOpenId(openId, mapping);
  if (!userId) return null;
  const row = await getUserById(db, userId);
  if (!row) return null;
  return { userId: row.id, name: row.name };
}
