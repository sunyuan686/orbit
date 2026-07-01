import { CANONICAL_AUTHORS, type CanonicalAuthor } from "../authors.js";
import { decryptSettingSecret } from "../lib/secret-crypto.js";
import { readSettingsMap } from "../db/settings-store.js";

export const FEISHU_SETTING_KEYS = {
  config: "feishu_config",
  appSecret: "feishu_app_secret",
  encryptKey: "feishu_encrypt_key",
} as const;

export interface FeishuAuthorOpenIds {
  小圆子: string;
  小麟子: string;
}

export interface FeishuConfigStored {
  enabled: boolean;
  appId: string;
  verificationToken: string;
  authorOpenIds: FeishuAuthorOpenIds;
  defaultEntryType: "diary";
  allowedGroupChatIds: string[];
  mergeWindowMs: number;
  homeChatId: string;
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
  connectionStatus: "connected" | "misconfigured" | "disabled";
  lastError: string | null;
  lastConnectedAt: number | null;
  webhookUrl: string;
}

export interface FeishuSecrets {
  appSecret: string;
  encryptKey: string;
}

const DEFAULT_CONFIG: FeishuConfigStored = {
  enabled: false,
  appId: "",
  verificationToken: "",
  authorOpenIds: { 小圆子: "", 小麟子: "" },
  defaultEntryType: "diary",
  allowedGroupChatIds: [],
  mergeWindowMs: 2000,
  homeChatId: "",
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
      authorOpenIds: {
        小圆子:
          typeof parsed.authorOpenIds?.小圆子 === "string"
            ? parsed.authorOpenIds.小圆子.trim()
            : "",
        小麟子:
          typeof parsed.authorOpenIds?.小麟子 === "string"
            ? parsed.authorOpenIds.小麟子.trim()
            : "",
      },
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

export function buildFeishuConfigPublic(
  config: FeishuConfigStored,
  hasAppSecret: boolean,
  hasEncryptKey: boolean,
  webhookUrl: string
): FeishuConfigPublic {
  let connectionStatus: FeishuConfigPublic["connectionStatus"] = "disabled";
  if (config.enabled) {
    connectionStatus =
      config.appId && hasAppSecret ? "connected" : "misconfigured";
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
    connectionStatus,
    lastError: config.lastError,
    lastConnectedAt: config.lastConnectedAt,
    webhookUrl,
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
  const config = parseFeishuConfig(map[FEISHU_SETTING_KEYS.config]);
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

export function resolveAuthorFromOpenId(
  openId: string,
  mapping: FeishuAuthorOpenIds
): CanonicalAuthor | null {
  const trimmed = openId.trim();
  if (!trimmed) return null;
  for (const author of CANONICAL_AUTHORS) {
    if (mapping[author] === trimmed) return author;
  }
  return null;
}
