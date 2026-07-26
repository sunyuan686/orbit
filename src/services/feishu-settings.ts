import { decryptSettingSecret } from "../lib/secret-crypto.js";
import { readSettingsMap } from "../db/settings-store.js";
import { getSpaceAuthors } from "./space-authors.js";

export const FEISHU_SETTING_KEYS = {
  config: "feishu_config",
  appSecret: "feishu_app_secret",
  encryptKey: "feishu_encrypt_key",
} as const;

/** userId → open_id */
export type FeishuAuthorOpenIds = Record<string, string>;

export interface FeishuConfigStored {
  enabled: boolean;
  appId: string;
  verificationToken: string;
  authorOpenIds: FeishuAuthorOpenIds;
  defaultEntryType: "diary";
  allowedGroupChatIds: string[];
  mergeWindowMs: number;
  homeChatId: string;
  replyInThread: boolean;
  lastError: string | null;
  lastConnectedAt: number | null;
}

export interface FeishuConfigPublic {
  enabled: boolean;
  appId: string;
  hasAppSecret: boolean;
  hasEncryptKey: boolean;
  verificationToken: string;
  authorOpenIds: FeishuAuthorOpenIds;
  defaultEntryType: "diary";
  allowedGroupChatIds: string[];
  mergeWindowMs: number;
  homeChatId: string;
  replyInThread: boolean;
  connectionStatus: "connected" | "misconfigured" | "disabled" | "verified";
  lastError: string | null;
  lastConnectedAt: number | null;
  webhookUrl: string;
  callbackUrl: string;
}

export interface FeishuSecrets {
  appSecret: string;
  encryptKey: string;
}

const DEFAULT_CONFIG: FeishuConfigStored = {
  enabled: false,
  appId: "",
  verificationToken: "",
  authorOpenIds: {},
  defaultEntryType: "diary",
  allowedGroupChatIds: [],
  mergeWindowMs: 2000,
  homeChatId: "",
  replyInThread: false,
  lastError: null,
  lastConnectedAt: null,
};

export function parseFeishuConfig(raw: string | undefined): FeishuConfigStored {
  if (!raw?.trim()) return { ...DEFAULT_CONFIG };
  try {
    const parsed = JSON.parse(raw) as Partial<FeishuConfigStored>;
    return {
      enabled: Boolean(parsed.enabled),
      appId: typeof parsed.appId === "string" ? parsed.appId.trim() : "",
      verificationToken:
        typeof parsed.verificationToken === "string"
          ? parsed.verificationToken.trim()
          : "",
      authorOpenIds: parseAuthorOpenIds(parsed.authorOpenIds),
      defaultEntryType: "diary",
      allowedGroupChatIds: Array.isArray(parsed.allowedGroupChatIds)
        ? parsed.allowedGroupChatIds
            .filter((id): id is string => typeof id === "string")
            .map((id) => id.trim())
            .filter(Boolean)
        : [],
      mergeWindowMs:
        typeof parsed.mergeWindowMs === "number" && parsed.mergeWindowMs >= 0
          ? parsed.mergeWindowMs
          : 2000,
      homeChatId:
        typeof parsed.homeChatId === "string" ? parsed.homeChatId.trim() : "",
      replyInThread: Boolean(parsed.replyInThread),
      lastError:
        typeof parsed.lastError === "string" ? parsed.lastError : null,
      lastConnectedAt:
        typeof parsed.lastConnectedAt === "number"
          ? parsed.lastConnectedAt
          : null,
    };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function serializeFeishuConfig(config: FeishuConfigStored): string {
  return JSON.stringify(config);
}

function parseAuthorOpenIds(raw: unknown): FeishuAuthorOpenIds {
  if (!raw || typeof raw !== "object") return {};
  const result: FeishuAuthorOpenIds = {};
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof value === "string") result[key] = value.trim();
  }
  return result;
}

export async function resolveFeishuAuthorOpenIds(
  db: any,
  stored: FeishuAuthorOpenIds
): Promise<FeishuAuthorOpenIds> {
  const authors = await getSpaceAuthors(db);
  const resolved: FeishuAuthorOpenIds = {};
  for (const author of authors) {
    resolved[author.id] =
      stored[author.id]?.trim() ||
      stored[author.name]?.trim() ||
      "";
  }
  return resolved;
}

export function buildFeishuConfigPublic(
  config: FeishuConfigStored,
  hasAppSecret: boolean,
  hasEncryptKey: boolean,
  eventWebhookUrl: string,
  callbackWebhookUrl: string
): FeishuConfigPublic {
  let connectionStatus: FeishuConfigPublic["connectionStatus"] = "disabled";
  if (config.enabled) {
    connectionStatus =
      config.appId && hasAppSecret ? "connected" : "misconfigured";
  } else if (config.appId && hasAppSecret && config.lastConnectedAt) {
    connectionStatus = "verified";
  }
  return {
    enabled: config.enabled,
    appId: config.appId,
    hasAppSecret,
    hasEncryptKey,
    verificationToken: config.verificationToken,
    authorOpenIds: config.authorOpenIds,
    defaultEntryType: config.defaultEntryType,
    allowedGroupChatIds: config.allowedGroupChatIds,
    mergeWindowMs: config.mergeWindowMs,
    homeChatId: config.homeChatId,
    replyInThread: config.replyInThread,
    connectionStatus,
    lastError: config.lastError,
    lastConnectedAt: config.lastConnectedAt,
    webhookUrl: eventWebhookUrl,
    callbackUrl: callbackWebhookUrl,
  };
}

export async function loadFeishuRuntime(
  db: any,
  secret: string
): Promise<{
  config: FeishuConfigStored;
  secrets: FeishuSecrets;
  hasAppSecret: boolean;
  hasEncryptKey: boolean;
}> {
  const map = await readSettingsMap(db);
  const parsed = parseFeishuConfig(map[FEISHU_SETTING_KEYS.config]);
  const config = {
    ...parsed,
    authorOpenIds: await resolveFeishuAuthorOpenIds(db, parsed.authorOpenIds),
  };
  const encryptedSecret = map[FEISHU_SETTING_KEYS.appSecret]?.trim() ?? "";
  const encryptedEncryptKey = map[FEISHU_SETTING_KEYS.encryptKey]?.trim() ?? "";
  const hasAppSecret = Boolean(encryptedSecret);
  const hasEncryptKey = Boolean(encryptedEncryptKey);

  let appSecret = "";
  let encryptKey = "";
  if (encryptedSecret) {
    appSecret = await decryptSettingSecret(encryptedSecret, secret);
  }
  if (encryptedEncryptKey) {
    encryptKey = await decryptSettingSecret(encryptedEncryptKey, secret);
  }

  return {
    config,
    secrets: { appSecret, encryptKey },
    hasAppSecret,
    hasEncryptKey,
  };
}

export function resolveUserIdFromOpenId(
  openId: string,
  mapping: FeishuAuthorOpenIds
): string | null {
  const trimmed = openId.trim();
  if (!trimmed) return null;
  for (const [userId, mappedOpenId] of Object.entries(mapping)) {
    if (mappedOpenId === trimmed) return userId;
  }
  return null;
}
