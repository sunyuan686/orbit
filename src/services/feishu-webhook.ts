import type { Context } from "hono";
import { decryptLarkPayload, verifyLarkSignature } from "./feishu-crypto.js";
import type { FeishuConfigStored, FeishuSecrets } from "./feishu-settings.js";

export interface LarkInboundPayload {
  challenge?: string;
  token?: string;
  type?: string;
  encrypt?: string;
  schema?: string;
  header?: {
    event_type?: string;
    event_id?: string;
    token?: string;
    app_id?: string;
  };
  event?: Record<string, unknown>;
  action?: Record<string, unknown>;
  open_message_id?: string;
  open_id?: string;
}

export interface FeishuWebhookRuntime {
  config: FeishuConfigStored;
  secrets: FeishuSecrets;
}

export function extractVerificationToken(
  payload: LarkInboundPayload
): string | undefined {
  if (typeof payload.token === "string" && payload.token) {
    return payload.token;
  }
  if (typeof payload.header?.token === "string" && payload.header.token) {
    return payload.header.token;
  }
  return undefined;
}

export function verificationTokenMismatch(
  runtime: FeishuWebhookRuntime,
  payload: LarkInboundPayload
): boolean {
  if (!runtime.config.verificationToken) return false;
  const token = extractVerificationToken(payload);
  return token !== runtime.config.verificationToken;
}

export async function tryParseUrlVerification(
  rawBody: string,
  encryptKey: string
): Promise<LarkInboundPayload | null> {
  try {
    const outer = JSON.parse(rawBody) as LarkInboundPayload;
    if (outer.type === "url_verification" && outer.challenge) {
      return outer;
    }
    if (outer.encrypt && encryptKey) {
      const decrypted = await decryptLarkPayload(outer.encrypt, encryptKey);
      const inner = JSON.parse(decrypted) as LarkInboundPayload;
      if (inner.type === "url_verification" && inner.challenge) {
        return inner;
      }
    }
  } catch {
    return null;
  }
  return null;
}

export async function parseLarkInboundBody(
  rawBody: string,
  encryptKey: string
): Promise<LarkInboundPayload> {
  const outer = JSON.parse(rawBody) as LarkInboundPayload;
  if (outer.encrypt && encryptKey) {
    const decrypted = await decryptLarkPayload(outer.encrypt, encryptKey);
    return JSON.parse(decrypted) as LarkInboundPayload;
  }
  return outer;
}

export async function verifyLarkInboundSignature(
  c: Context,
  encryptKey: string,
  rawBody: string
): Promise<boolean> {
  const timestamp = c.req.header("X-Lark-Request-Timestamp") ?? "";
  const nonce = c.req.header("X-Lark-Request-Nonce") ?? "";
  const signature = c.req.header("X-Lark-Signature") ?? "";
  return verifyLarkSignature(
    timestamp,
    nonce,
    encryptKey,
    rawBody,
    signature
  );
}

export function resolveCallbackEventType(
  payload: LarkInboundPayload
): string | undefined {
  if (payload.header?.event_type) return payload.header.event_type;
  if (payload.open_message_id && payload.action) {
    return "card.action.trigger_v1";
  }
  return undefined;
}
