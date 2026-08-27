/**
 * VAPID JWT 签名（Web Crypto API）
 * 兼容 Cloudflare Workers / 浏览器环境，不依赖 Node.js crypto
 *
 * 参考：RFC 8292 Voluntary Application Server Identification for Web Push
 */

const subtle = (globalThis.crypto ?? globalThis.crypto).subtle;

function b64urlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(b64);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

function bytesToB64url(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
}

function jsonB64url(obj: unknown): string {
  return bytesToB64url(new TextEncoder().encode(JSON.stringify(obj)));
}

/** 导入 PKCS#8 格式的 ECDSA P-256 私钥（base64url 编码） */
async function importPrivateKey(pkcs8B64url: string): Promise<CryptoKey> {
  return subtle.importKey(
    "pkcs8",
    b64urlToBytes(pkcs8B64url).buffer as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

/**
 * 生成 VAPID Authorization 头值
 * @param audience 推送服务端点的 origin（如 https://fcm.googleapis.com）
 * @param subject mailto: 联系地址
 * @param vapidPrivateKey PKCS#8 base64url 编码私钥
 * @param vapidPublicKey 未压缩点 base64url 编码公钥
 */
export async function buildVapidAuthHeader(
  audience: string,
  subject: string,
  vapidPrivateKey: string,
  vapidPublicKey: string
): Promise<string> {
  const header = jsonB64url({ typ: "JWT", alg: "ES256" });
  const now = Math.floor(Date.now() / 1000);
  const payload = jsonB64url({
    aud: audience,
    exp: now + 12 * 3600,
    sub: subject,
  });

  const sigInput = new TextEncoder().encode(`${header}.${payload}`);
  const privateKey = await importPrivateKey(vapidPrivateKey);
  const sigDer = await subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    sigInput
  );
  const sig = bytesToB64url(new Uint8Array(sigDer));

  const jwt = `${header}.${payload}.${sig}`;
  return `vapid t=${jwt},k=${vapidPublicKey}`;
}

/**
 * 发送 Web Push 通知（无 payload 加密，服务端仅发信号，SW 自行拉取通知内容）
 */
export async function sendWebPush(opts: {
  endpoint: string;
  vapidPrivateKey: string;
  vapidPublicKey: string;
  vapidSubject: string;
  ttl?: number;
}): Promise<{ ok: boolean; status?: number; error?: string }> {
  const { endpoint, vapidPrivateKey, vapidPublicKey, vapidSubject, ttl = 86400 } = opts;

  let audience: string;
  try {
    audience = new URL(endpoint).origin;
  } catch {
    return { ok: false, error: "invalid_endpoint" };
  }

  let authorization: string;
  try {
    authorization = await buildVapidAuthHeader(
      audience,
      vapidSubject,
      vapidPrivateKey,
      vapidPublicKey
    );
  } catch (err) {
    return { ok: false, error: `vapid_sign_failed: ${String(err)}` };
  }

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        TTL: String(ttl),
        // 无 payload，不加 Content-Type
      },
    });

    if (res.ok || res.status === 201) return { ok: true, status: res.status };

    // 410/404 表示订阅已失效
    return { ok: false, status: res.status, error: `push_http_${res.status}` };
  } catch (err) {
    return { ok: false, error: `fetch_failed: ${String(err)}` };
  }
}
