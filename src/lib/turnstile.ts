import { createLogger } from "./logger.js";

const turnstileLog = createLogger("turnstile");

export interface TurnstileVerifyResponse {
  success: boolean;
  "error-codes"?: string[];
  challenge_ts?: string;
  hostname?: string;
}

/**
 * 校验前端提交的 Cloudflare Turnstile token
 * @param token 前端传入的 turnstile 响应 token
 * @param remoteIp 客户端真实 IP (可选)
 */
export async function verifyTurnstileToken(
  token: string,
  remoteIp?: string
): Promise<TurnstileVerifyResponse> {
  const secretKey = process.env.TURNSTILE_SECRET_KEY;

  if (!secretKey) {
    turnstileLog.info("TURNSTILE_SECRET_KEY 未配置，跳过 Turnstile 校验");
    return { success: true };
  }

  if (!token) {
    return { success: false, "error-codes": ["missing-input-response"] };
  }

  try {
    const payload: Record<string, string> = {
      secret: secretKey,
      response: token,
    };

    if (remoteIp) {
      const cleanIp = remoteIp.split(",")[0].trim();
      // 过滤局域网私有 IP 与多重 IP 头，仅在符合标准 IP 时发送
      if (
        cleanIp &&
        !cleanIp.startsWith("127.") &&
        !cleanIp.startsWith("192.168.") &&
        !cleanIp.startsWith("10.") &&
        !cleanIp.startsWith("::")
      ) {
        payload.remoteip = cleanIp;
      }
    }

    const response = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errText = await response.text().catch(() => "");
      turnstileLog.error("Cloudflare siteverify 请求 HTTP 错误", {
        status: response.status,
        secretKeyPrefix: secretKey.substring(0, 10),
        body: errText,
      });
      return { success: false, "error-codes": ["siteverify-request-failed"] };
    }

    const data = (await response.json()) as TurnstileVerifyResponse;
    if (!data.success) {
      turnstileLog.warn("Turnstile 验证未通过", {
        secretKeyPrefix: secretKey.substring(0, 10),
        errorCodes: data["error-codes"],
        hostname: data.hostname,
      });
    } else {
      turnstileLog.info("Turnstile 验证通过", { hostname: data.hostname });
    }
    return data;
  } catch (error) {
    turnstileLog.error("Turnstile 校验过程中抛出异常", { error });
    return { success: false, "error-codes": ["internal-error"] };
  }
}
