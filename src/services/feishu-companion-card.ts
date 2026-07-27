/**
 * 飞书陪伴卡片构建器 (Feishu Companion Card)
 *
 * 负责：
 *  1. 从 companion-engine 拿到候选，调用 AI 生成润色文案（严格基于原文）
 *  2. 构建飞书 Interactive Card JSON
 *  3. 投递卡片，写入 companion_log
 *  4. 同时写入站内 notification
 */

import { generateText } from "ai";
import {
  getTenantAccessToken,
  sendFeishuInteractiveCard,
} from "./feishu-api.js";
import { loadFeishuRuntime } from "./feishu-settings.js";
import { resolveModel } from "./ai-model.js";
import { readSettingsMap } from "../db/settings-store.js";
import {
  type CompanionCandidate,
  writeCompanionLog,
} from "./companion-engine.js";
import { generateId } from "../lib/id.js";
import { MILESTONE_DEFINITIONS } from "./love-memories.js";

/** milestoneKey → 人类可读标题 */
const MILESTONE_TITLE_MAP = new Map(
  MILESTONE_DEFINITIONS.map((m) => [m.key, m.title])
);
import { notification } from "../db/schema.js";

// ─── AI 润色 ─────────────────────────────────────────────────────────────────

const COMPANION_SYSTEM_PROMPT = `你是一个温柔、克制的空间文字助理。你的任务是根据提供的二人真实历史记录，生成一句简短有温度的引言。
规则：
1. 必须完全基于提供的输入文本，严禁编造或推测未提及的细节。
2. 字数控制在 30~60 字以内，风格典雅、克制，符合 Orbit 暖石风格。
3. 如果输入记录较少，直接输出原句摘录，不要过度修饰。
4. 只输出引言本身，不要任何解释或前缀。`;

async function generateAiTagline(
  excerpt: string,
  aiEnv: Record<string, unknown>
): Promise<string> {
  if (!excerpt.trim()) return "";
  try {
    const settingsMap = await readSettingsMap(aiEnv._db as any);
    const model = await resolveModel(settingsMap, aiEnv as any);
    const { text } = await generateText({
      model: model.model,
      system: COMPANION_SYSTEM_PROMPT,
      prompt: `历史记录片段：\n${excerpt.slice(0, 500)}`,
      maxOutputTokens: 120,
      temperature: 0.6,
    });
    return text.trim().slice(0, 80);
  } catch {
    // AI 调用失败时直接使用原摘录
    return excerpt.slice(0, 60);
  }
}

// ─── 飞书 Interactive Card 构建 ───────────────────────────────────────────────

function buildHeader(candidate: CompanionCandidate): string {
  const ctx = candidate.context;
  switch (candidate.type) {
    case "memory_echo": {
      const anchor = ctx.anchorKey as string | undefined;
      const suffix = anchor ? ` · ${anchor}` : "";
      return `旧时回忆${suffix}`;
    }
    case "milestone": {
      const isToday = ctx.isToday as boolean;
      const days = ctx.advanceDays as number;
      const milestoneTitle = MILESTONE_TITLE_MAP.get(ctx.milestoneKey as string) ?? "纪念日";
      return isToday ? `${milestoneTitle} 🎉` : `${milestoneTitle} · 还有 ${days} 天`;
    }
    case "digest":
      return "TA 留下了一封信";
    case "weekly_reflection":
      return `本周回顾 · ${ctx.weekOf as string}`;
  }
}

function buildCard(
  candidate: CompanionCandidate,
  tagline: string,
  deepLink: string
): Record<string, unknown> {
  const header = buildHeader(candidate);

  const elements: unknown[] = [];

  if (tagline) {
    elements.push({
      tag: "markdown",
      content: `> ${tagline}`,
    });
  }

  if (candidate.type === "milestone") {
    const def = MILESTONE_DEFINITIONS.find(m => m.key === candidate.context.milestoneKey);
    if (def?.description) {
      elements.push({
        tag: "markdown",
        content: def.description,
      });
    }
  }

  if (candidate.type === "weekly_reflection") {
    elements.push({
      tag: "markdown",
      content: `本周共 **${candidate.context.entryCount}** 条记录，累计 **${candidate.context.totalChars}** 字。`,
    });
    // weeklyTagline 由外层 AI 生成后注入 context
    if (candidate.context.weeklyTagline) {
      elements.unshift({
        tag: "markdown",
        content: `> ${candidate.context.weeklyTagline}`,
      });
    }
  }

  elements.push({ tag: "hr" });
  elements.push({
    tag: "button",
    text: { tag: "plain_text", content: "回到 Orbit 查看详情" },
    type: "default",
    multi_url: { url: deepLink },
    url: deepLink,
    behaviors: [{ type: "open_url", default_url: deepLink }],
  });

  return {
    schema: "2.0",
    header: {
      title: { tag: "plain_text", content: header },
      template: "default",
    },
    body: { elements },
  };
}

// ─── 深链接生成 ───────────────────────────────────────────────────────────────

function buildDeepLink(baseUrl: string, candidate: CompanionCandidate): string {
  const root = baseUrl.replace(/\/$/, "");
  const ctx = candidate.context;
  switch (candidate.type) {
    case "memory_echo":
      return `${root}/${ctx.entryType ?? "diary"}/${ctx.entryId}`;
    case "milestone":
      return `${root}/memories`;
    case "digest":
      return `${root}/letter/${ctx.entryId}`;
    case "weekly_reflection":
      return `${root}/diary`;
  }
}

// ─── 站内通知 ─────────────────────────────────────────────────────────────────

async function writeInAppNotification(
  db: any,
  candidate: CompanionCandidate,
  header: string,
  tagline: string,
  deepLink: string,
  nowTs: number
): Promise<void> {
  const id = generateId("ntf");
  await db.insert(notification).values({
    id,
    recipient: "companion",
    recipientUserId: candidate.recipientUserId,
    type: `companion.${candidate.type}`,
    targetType: "entry",
    targetId: candidate.targetId ?? candidate.type,
    actor: "orbit",
    actorUserId: candidate.recipientUserId,
    title: header,
    body: tagline || header,
    link: deepLink,
    payload: JSON.stringify({ companionType: candidate.type }),
    createdAt: nowTs,
    updatedAt: nowTs,
  });
}

// ─── 主投递函数 ───────────────────────────────────────────────────────────────

export interface DeliverOptions {
  db: any;
  secret: string;
  baseUrl: string;
  aiEnv?: Record<string, unknown>;
}

/**
 * 投递单条陪伴卡片。
 * - 写飞书 Interactive Card
 * - 写站内 notification
 * - 写 companion_log（sent / failed）
 */
export async function deliverCompanionCard(
  candidate: CompanionCandidate,
  opts: DeliverOptions,
  nowTs = Math.floor(Date.now() / 1000)
): Promise<void> {
  const { db, secret, baseUrl, aiEnv } = opts;

  const excerpt =
    (candidate.context.excerpt as string | undefined) ??
    (candidate.context.title as string | undefined) ??
    "";

  // Weekly Reflection：从本周记录里取摘录给 AI 润色，注入 context
  if (candidate.type === "weekly_reflection" && aiEnv) {
    const entryIds = candidate.context.entryIds as string[];
    if (entryIds?.length > 0) {
      try {
        const { entry: entryTable } = await import("../db/schema.js");
        const { inArray } = await import("drizzle-orm");
        const rows = await db
          .select({ bodyText: entryTable.bodyText, title: entryTable.title })
          .from(entryTable)
          .where(inArray(entryTable.id, entryIds.slice(0, 5)));
        const combinedExcerpt = rows
          .map((r: { title: string | null; bodyText: string | null }) =>
            [r.title, (r.bodyText ?? "").slice(0, 100)].filter(Boolean).join("：")
          )
          .join("\n");
        if (combinedExcerpt.trim()) {
          const weeklyTagline = await generateAiTagline(combinedExcerpt, { ...aiEnv, _db: db });
          candidate.context.weeklyTagline = weeklyTagline;
        }
      } catch {
        // 静默失败，卡片仍正常展示
      }
    }
  }

  // AI 润色文案
  const tagline = aiEnv
    ? await generateAiTagline(excerpt, { ...aiEnv, _db: db })
    : excerpt.slice(0, 60);

  const deepLink = buildDeepLink(baseUrl, candidate);
  const header = buildHeader(candidate);
  const card = buildCard(candidate, tagline, deepLink);

  let status: "sent" | "failed" = "failed";

  try {
    // 写站内通知（不依赖飞书是否配置）
    await writeInAppNotification(db, candidate, header, tagline, deepLink, nowTs).catch(() => {});

    // 飞书投递
    const runtime = await loadFeishuRuntime(db, secret);
    if (runtime.config.enabled && runtime.config.appId && runtime.secrets.appSecret) {
      const openId = runtime.config.authorOpenIds[candidate.recipientUserId] ?? "";
      const target = runtime.config.homeChatId.trim() || openId.trim();
      if (target) {
        const token = await getTenantAccessToken(runtime.config.appId, runtime.secrets.appSecret);
        const receiveIdType = runtime.config.homeChatId.trim() ? "chat_id" : "open_id";
        await sendFeishuInteractiveCard(token, target, receiveIdType, card);
      } else {
        console.info(`[companion] feishu skipped: no target (homeChatId and openId both empty), userId=${candidate.recipientUserId}, type=${candidate.type}`);
      }
    }
    else {
      const reason = !runtime.config.enabled
        ? "feishu disabled"
        : !runtime.config.appId
          ? "appId empty"
          : "appSecret empty";
      console.info(`[companion] feishu skipped: ${reason}, type=${candidate.type}`);
    }

    status = "sent";
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    const code = (err as any)?.code !== undefined ? ` (code=${(err as any).code})` : "";
    console.error(`[companion] deliver failed: ${msg}${code}`, err instanceof Error ? err.stack : err);
    status = "failed";
  }

  await writeCompanionLog(db, candidate, status, nowTs);
}
