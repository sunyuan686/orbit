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
  downloadFeishuMessageImage,
  getTenantAccessToken,
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

export interface FeishuInboundMessage {
  messageId: string;
  chatId: string;
  chatType: "p2p" | "group" | string;
  messageType: string;
  content: string;
  senderOpenId: string;
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
  return (
    trimmed.startsWith("/") ||
    trimmed.startsWith("搜") ||
    trimmed.startsWith("查")
  );
}

function parseWriteIntent(raw: string, defaultType: string): ParsedWrite | null {
  const text = raw.trim();
  if (!text) return null;

  const backdate = text.match(
    /^补记\s*(\d{1,2})[\/\-.](\d{1,2})[：:]\s*([\s\S]+)$/
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

  if (text.startsWith("留言：") || text.startsWith("留言:")) {
    const body = text.replace(/^留言[：:]/, "").trim();
    if (!body) return null;
    return { entryType: "message", entryDate: now(), text: body };
  }

  if (text.startsWith("信：") || text.startsWith("信:")) {
    const body = text.replace(/^信[：:]/, "").trim();
    if (!body) return null;
    return { entryType: "letter", entryDate: now(), text: body };
  }

  return { entryType: defaultType, entryDate: now(), text };
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
    .select({ body: entry.body })
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
}

export async function processFeishuInboundMessage(
  ctx: FeishuInboundContext,
  message: FeishuInboundMessage,
  options: { hasGroupMention: boolean }
): Promise<void> {
  const actor = await resolveActorFromMapping(
    ctx.db,
    message.senderOpenId,
    ctx.config.authorOpenIds
  );
  if (!actor) {
    await replyText(ctx, message, "未授权：请先在 Orbit 设置页绑定你的飞书 open_id。");
    return;
  }

  if (message.chatType === "group") {
    if (ctx.config.allowedGroupChatIds.length === 0) return;
    if (!ctx.config.allowedGroupChatIds.includes(message.chatId)) return;
    if (!options.hasGroupMention) return;
  }

  const text = extractTextFromContent(message.messageType, message.content);
  const imageKey = extractImageKey(message.messageType, message.content);

  if (text && isQueryCommand(text)) {
    await handleQueryCommand(ctx, message, text);
    return;
  }

  let entryId: string | null = null;
  if (text) {
    const parsed = parseWriteIntent(text, ctx.config.defaultEntryType);
    if (parsed) {
      entryId = await writeEntryText(ctx, actor, parsed);
    }
  } else if (imageKey) {
    entryId = await writeEntryText(ctx, actor, {
      entryType: ctx.config.defaultEntryType,
      entryDate: now(),
      text: "（飞书图片）",
    });
  }

  if (entryId && imageKey) {
    await attachImageToEntry(ctx, entryId, message, imageKey);
  }

  if (entryId) {
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
    const label = labels[row?.type ?? "diary"] ?? "内容";
    await replyText(ctx, message, `已记入${label} ✅`);
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
