import type { UIMessage } from "ai";
import { extractTextFromParts } from "./ai-chat-store.js";

export interface FeishuInboundMention {
  key: string;
  openId?: string;
  name?: string;
}

interface FeishuMentionLike {
  key?: string;
  id?: {
    open_id?: string;
    user_id?: string;
    union_id?: string;
  };
  name?: string;
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function normalizeMentionKey(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

export function parseFeishuInboundMentions(raw: unknown): FeishuInboundMention[] {
  if (!Array.isArray(raw)) return [];
  const mentions: FeishuInboundMention[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const mention = item as FeishuMentionLike;
    const key = normalizeMentionKey(mention.key);
    if (!key) continue;
    mentions.push({
      key,
      openId: normalizeMentionKey(mention.id?.open_id),
      name: normalizeMentionKey(mention.name),
    });
  }
  return mentions;
}

function isFeishuBroadcastMention(mention: FeishuMentionLike): boolean {
  const normalizedKey = mention.key?.trim().toLowerCase();
  if (normalizedKey === "@all" || normalizedKey === "@_all") {
    return true;
  }
  const mentionIds = [
    mention.id?.open_id,
    mention.id?.user_id,
    mention.id?.union_id,
  ];
  return mentionIds.some((id) => id?.trim().toLowerCase() === "all");
}

export function isFeishuBotMentioned(
  mentions: FeishuInboundMention[],
  botOpenId?: string
): boolean {
  if (!botOpenId?.trim()) {
    return mentions.length > 0;
  }
  const normalizedBotOpenId = botOpenId.trim();
  return mentions.some(
    (mention) => mention.openId === normalizedBotOpenId
  );
}

/**
 * Strip Feishu mention placeholders (e.g. @_user_1) from inbound text.
 * Bot mentions are removed; other mentions become @name for optional context.
 */
export function normalizeFeishuMentions(
  text: string,
  mentions: FeishuInboundMention[],
  botOpenId?: string
): string {
  if (!text || mentions.length === 0) {
    return text.trim();
  }

  const normalizedBotOpenId = botOpenId?.trim();
  let result = text;
  for (const mention of mentions) {
    const replacement =
      normalizedBotOpenId && mention.openId === normalizedBotOpenId
        ? ""
        : mention.name
          ? `@${mention.name}`
          : "";
    result = result
      .replace(new RegExp(escapeRegExp(mention.key), "g"), () => replacement)
      .trim();
  }

  return result.replace(/\s+/g, " ").trim();
}

/**
 * Prefix group chat user text with speaker label so the model can attribute messages.
 */
export function buildFeishuAgentUserText(params: {
  text: string;
  chatType?: string;
  speakerName?: string;
  speakerOpenId?: string;
}): string {
  const text = params.text.trim();
  if (!text) return text;
  if (params.chatType !== "group") return text;

  const speaker = params.speakerName?.trim() || params.speakerOpenId?.trim();
  if (!speaker) return text;
  if (text.startsWith(`${speaker}:`)) return text;
  return `${speaker}: ${text}`;
}

export function stripFeishuSpeakerPrefix(text: string): string {
  const trimmed = text.trim();
  const colonIndex = trimmed.indexOf(":");
  if (colonIndex <= 0) return trimmed;
  const speaker = trimmed.slice(0, colonIndex).trim();
  const body = trimmed.slice(colonIndex + 1).trim();
  if (!speaker || !body) return trimmed;
  return body;
}

export function prepareFeishuInboundText(params: {
  text: string;
  chatType?: string;
  mentions?: FeishuInboundMention[];
  botOpenId?: string;
  speakerName?: string;
  speakerOpenId?: string;
}): string {
  const stripped = normalizeFeishuMentions(
    params.text,
    params.mentions ?? [],
    params.botOpenId
  );
  return buildFeishuAgentUserText({
    text: stripped,
    chatType: params.chatType,
    speakerName: params.speakerName,
    speakerOpenId: params.speakerOpenId,
  });
}

/**
 * Ensure stored group history includes speaker labels when converting to model input.
 */
export function enrichFeishuGroupMessagesForModel(
  messages: UIMessage[],
  chatType?: string
): UIMessage[] {
  if (chatType !== "group") return messages;

  return messages.map((message) => {
    if (message.role !== "user") return message;

    const author = (
      message as UIMessage & { metadata?: { author?: string } }
    ).metadata?.author?.trim();
    if (!author) return message;

    const text = extractTextFromParts(message.parts).trim();
    if (!text || text.startsWith(`${author}:`)) return message;

    return {
      ...message,
      parts: [{ type: "text" as const, text: `${author}: ${text}` }],
    };
  });
}
