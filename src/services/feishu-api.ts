const FEISHU_API = "https://open.feishu.cn/open-apis";

interface TenantTokenCache {
  token: string;
  expiresAt: number;
}

let tenantTokenCache: TenantTokenCache | null = null;

export class FeishuApiError extends Error {
  constructor(
    message: string,
    readonly code?: number
  ) {
    super(message);
    this.name = "FeishuApiError";
  }
}

async function feishuJson<T>(
  url: string,
  init: RequestInit & { accessToken?: string } = {}
): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");
  if (init.accessToken) {
    headers.set("Authorization", `Bearer ${init.accessToken}`);
  }
  const res = await fetch(url, { ...init, headers });
  const data = (await res.json()) as {
    code?: number;
    msg?: string;
    data?: T;
  };
  if (!res.ok || (data.code !== undefined && data.code !== 0)) {
    throw new FeishuApiError(data.msg ?? `Feishu API error (${res.status})`, data.code);
  }
  return data.data as T;
}

export async function getTenantAccessToken(
  appId: string,
  appSecret: string
): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (
    tenantTokenCache &&
    tenantTokenCache.expiresAt > now + 60 &&
    tenantTokenCache.token
  ) {
    return tenantTokenCache.token;
  }

  const data = await feishuJson<{ tenant_access_token: string; expire: number }>(
    `${FEISHU_API}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );

  tenantTokenCache = {
    token: data.tenant_access_token,
    expiresAt: now + (data.expire ?? 7200),
  };
  return data.tenant_access_token;
}

export function clearTenantAccessTokenCache(): void {
  tenantTokenCache = null;
}

export async function sendFeishuTextMessage(
  accessToken: string,
  receiveId: string,
  receiveIdType: "open_id" | "chat_id",
  text: string
): Promise<void> {
  const params = new URLSearchParams({ receive_id_type: receiveIdType });
  await feishuJson(
    `${FEISHU_API}/im/v1/messages?${params.toString()}`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "text",
        content: JSON.stringify({ text }),
      }),
    }
  );
}

export async function downloadFeishuMessageImage(
  accessToken: string,
  messageId: string,
  imageKey: string
): Promise<{ body: ArrayBuffer; mimeType: string }> {
  const url = `${FEISHU_API}/im/v1/messages/${messageId}/resources/${imageKey}?type=image`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new FeishuApiError(`download image failed (${res.status})`);
  }
  const mimeType = res.headers.get("content-type") ?? "image/jpeg";
  const body = await res.arrayBuffer();
  return { body, mimeType };
}

export async function testFeishuConnection(input: {
  appId: string;
  appSecret: string;
  homeChatId?: string;
  authorOpenId?: string;
}): Promise<void> {
  const token = await getTenantAccessToken(input.appId, input.appSecret);
  const target = input.homeChatId?.trim() || input.authorOpenId?.trim();
  if (!target) {
    return;
  }
  const receiveIdType = input.homeChatId?.trim() ? "chat_id" : "open_id";
  await sendFeishuTextMessage(
    token,
    target,
    receiveIdType,
    "Orbit 飞书连接测试成功 ✅"
  );
}
