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
  const rawText = (await res.text()).trim();
  let data: { code?: number; msg?: string; data?: T } = {};
  if (rawText) {
    try {
      data = JSON.parse(rawText);
    } catch {
      // 无法解析 JSON（如空响应或纯文本），只要 res.ok 即可
    }
  }
  if (!res.ok || (data.code !== undefined && data.code !== 0 && data.code !== 200610)) {
    throw new FeishuApiError(data.msg ?? `Feishu API error (${res.status})`, data.code);
  }
  return (data.data ?? (data as unknown as T)) as T;
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

  const res = await fetch(
    `${FEISHU_API}/auth/v3/tenant_access_token/internal`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({ app_id: appId, app_secret: appSecret }),
    }
  );

  const body = (await res.json()) as {
    code?: number;
    msg?: string;
    tenant_access_token?: string;
    expire?: number;
  };

  if (!res.ok || (body.code !== undefined && body.code !== 0)) {
    throw new FeishuApiError(
      body.msg ?? `获取 tenant_access_token 失败 (${res.status})`,
      body.code
    );
  }

  const token = body.tenant_access_token?.trim();
  if (!token) {
    throw new FeishuApiError(body.msg ?? "飞书未返回 tenant_access_token");
  }

  tenantTokenCache = {
    token,
    expiresAt: now + (body.expire ?? 7200),
  };
  return token;
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

/** 飞书 interactive 卡片（schema 1.0 简易结构） */
export async function sendFeishuInteractiveCard(
  accessToken: string,
  receiveId: string,
  receiveIdType: "open_id" | "chat_id",
  card: Record<string, unknown>
): Promise<void> {
  const params = new URLSearchParams({ receive_id_type: receiveIdType });
  await feishuJson(
    `${FEISHU_API}/im/v1/messages?${params.toString()}`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "interactive",
        content: JSON.stringify(card),
      }),
    }
  );
}

/**
 * 给飞书特定消息添加 Reaction 表情回应（如 "Typing", "DONE", "THUMBSUP"）
 */
export async function addFeishuReaction(
  accessToken: string,
  messageId: string,
  emojiType: string
): Promise<string> {
  const result = await feishuJson<{ reaction_id: string }>(
    `${FEISHU_API}/im/v1/messages/${encodeURIComponent(messageId)}/reactions`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        reaction_type: { emoji_type: emojiType },
      }),
    }
  );
  return result.reaction_id;
}

/**
 * 撤销/删除飞书特定消息上的 Reaction 表情回应
 */
export async function removeFeishuReaction(
  accessToken: string,
  messageId: string,
  reactionId: string
): Promise<void> {
  await feishuJson<void>(
    `${FEISHU_API}/im/v1/messages/${encodeURIComponent(messageId)}/reactions/${encodeURIComponent(reactionId)}`,
    {
      method: "DELETE",
      accessToken,
    }
  );
}

/**
 * 回复某条特定的消息（如果 replyInThread 为 true，会在话题 Thread 中回复）
 */
export async function replyFeishuTextMessage(
  accessToken: string,
  messageId: string,
  text: string,
  replyInThread: boolean = false
): Promise<string> {
  const result = await feishuJson<{ message_id: string }>(
    `${FEISHU_API}/im/v1/messages/${encodeURIComponent(messageId)}/reply`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        msg_type: "text",
        content: JSON.stringify({ text }),
        reply_in_thread: replyInThread,
      }),
    }
  );
  return result.message_id;
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
  const homeChatId = input.homeChatId?.trim() ?? "";
  const authorOpenId = input.authorOpenId?.trim() ?? "";

  if (!homeChatId && !authorOpenId) {
    throw new FeishuApiError(
      "请配置 Home Chat，或填写当前账号对应的 open_id 后再测试"
    );
  }

  const attempts: Array<{ target: string; type: "open_id" | "chat_id" }> = [];
  if (authorOpenId) {
    attempts.push({ target: authorOpenId, type: "open_id" });
  }
  if (homeChatId) {
    attempts.push({ target: homeChatId, type: "chat_id" });
  }

  let lastError: FeishuApiError | null = null;
  for (const attempt of attempts) {
    try {
      await sendFeishuTextMessage(
        token,
        attempt.target,
        attempt.type,
        "Orbit 飞书连接测试成功 ✅"
      );
      return;
    } catch (err) {
      lastError =
        err instanceof FeishuApiError
          ? err
          : new FeishuApiError(
              err instanceof Error ? err.message : "飞书连接测试失败"
            );
      const retryable =
        attempt.type === "chat_id" &&
        /out of the chat/i.test(lastError.message) &&
        authorOpenId;
      if (!retryable) throw toFriendlyFeishuError(lastError);
    }
  }

  throw toFriendlyFeishuError(
    lastError ?? new FeishuApiError("飞书连接测试失败")
  );
}

function toFriendlyFeishuError(err: FeishuApiError): FeishuApiError {
  if (/out of the chat/i.test(err.message)) {
    return new FeishuApiError(
      "Bot 未加入该群聊：请先把 Bot 拉进 Home Chat 对应群，或清空 Home Chat 改用单聊测试"
    );
  }
  if (/chat id not found|invalid receive id/i.test(err.message)) {
    return new FeishuApiError("chat_id 或 open_id 无效，请检查设置页配置");
  }
  return err;
}

// ─── CardKit 流式 API ────────────────────────────────────────────────────────

/**
 * 创建通用飞书 CardKit 2.0 卡片实体，返回 cardId。
 */
export async function createFeishuCardJson(
  accessToken: string,
  cardJsonObj: Record<string, any>
): Promise<string> {
  const result = await feishuJson<{ card_id: string }>(
    `${FEISHU_API}/cardkit/v1/cards`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        type: "card_json",
        data: JSON.stringify(cardJsonObj),
      }),
    }
  );
  return result.card_id;
}

export const CARDKIT_TOOL_ELEMENT_ID = "tool_status";
export const CARDKIT_AI_ELEMENT_ID = "ai_content";

/**
 * 创建飞书 CardKit 流式卡片，包含工具/来源展示区 (tool_status) 与 AI 正文区 (ai_content)。
 */
export async function createFeishuStreamingCard(
  accessToken: string
): Promise<{ cardId: string; toolElementId: string; aiElementId: string }> {
  const result = await feishuJson<{ card_id: string }>(
    `${FEISHU_API}/cardkit/v1/cards`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        type: "card_json",
        data: JSON.stringify({
          schema: "2.0",
          config: { streaming_mode: true },
          body: {
            elements: [
              {
                tag: "markdown",
                element_id: CARDKIT_TOOL_ELEMENT_ID,
                content: "",
              },
              {
                tag: "markdown",
                element_id: CARDKIT_AI_ELEMENT_ID,
                content: "⏳",
              },
            ],
          },
        }),
      }),
    }
  );
  return {
    cardId: result.card_id,
    toolElementId: CARDKIT_TOOL_ELEMENT_ID,
    aiElementId: CARDKIT_AI_ELEMENT_ID,
  };
}

/**
 * 以 interactive 消息发送已创建的 CardKit 卡片，返回 message_id。
 */
export async function sendFeishuCardMessage(
  accessToken: string,
  receiveId: string,
  receiveIdType: "open_id" | "chat_id",
  cardId: string
): Promise<string> {
  const params = new URLSearchParams({ receive_id_type: receiveIdType });
  const result = await feishuJson<{ message_id: string }>(
    `${FEISHU_API}/im/v1/messages?${params.toString()}`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        receive_id: receiveId,
        msg_type: "interactive",
        content: JSON.stringify({
          type: "card",
          data: { card_id: cardId },
        }),
      }),
    }
  );
  return result.message_id;
}

/**
 * 以 CardKit 卡片形式回复指定消息（如果在 Thread 中可保持在话题内部）
 */
export async function replyFeishuCardMessage(
  accessToken: string,
  messageId: string,
  cardId: string,
  replyInThread: boolean = false
): Promise<string> {
  const result = await feishuJson<{ message_id: string }>(
    `${FEISHU_API}/im/v1/messages/${encodeURIComponent(messageId)}/reply`,
    {
      method: "POST",
      accessToken,
      body: JSON.stringify({
        msg_type: "interactive",
        content: JSON.stringify({
          type: "card",
          data: { card_id: cardId },
        }),
        reply_in_thread: replyInThread,
      }),
    }
  );
  return result.message_id;
}

/**
 * 向 CardKit 卡片的指定元素追加内容（流式 append 模式，需带递增 sequence 序号）。
 */
export async function appendFeishuCardContent(
  accessToken: string,
  cardId: string,
  elementId: string,
  content: string,
  sequence: number
): Promise<void> {
  await feishuJson<void>(
    `${FEISHU_API}/cardkit/v1/cards/${encodeURIComponent(cardId)}/elements/${encodeURIComponent(elementId)}/content`,
    {
      method: "PUT",
      accessToken,
      body: JSON.stringify({ content, sequence }),
    }
  );
}

/**
 * 关闭 CardKit 卡片的流式状态，卡片定型（需带递增 sequence 序号，彻底消除客户端 [生成中...] 标签）。
 */
export async function finalizeFeishuStreamingCard(
  accessToken: string,
  cardId: string,
  sequence: number
): Promise<void> {
  await feishuJson<void>(
    `${FEISHU_API}/cardkit/v1/cards/${encodeURIComponent(cardId)}/settings`,
    {
      method: "PATCH",
      accessToken,
      body: JSON.stringify({
        settings: JSON.stringify({ config: { streaming_mode: false } }),
        sequence,
      }),
    }
  );
}
