import os from "node:os";

/** 获取本机在局域网中的 IPv4 地址，生成形如 http://192.168.x.x:5173 的 Origin */
function getLocalIpOrigins(port = 5173): string[] {
  try {
    const interfaces = os.networkInterfaces();
    const origins: string[] = [];
    for (const name of Object.keys(interfaces)) {
      for (const iface of interfaces[name] || []) {
        if (iface.family === "IPv4" && !iface.internal) {
          origins.push(`http://${iface.address}:${port}`);
          origins.push(`https://${iface.address}:${port}`);
        }
      }
    }
    return origins;
  } catch {
    return [];
  }
}

/**
 * better-auth 的 baseURL 必须是浏览器实际访问的前端地址。
 * 本地 dev：Vite 在 5173，API 经代理转发到 3001，Origin 仍是 5173。
 * 生产：Worker 同域提供前端与 API，通过 BETTER_AUTH_URL 注入。
 */
export const AUTH_BASE_URL =
  process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

/** 本地 Vite 绑定 0.0.0.0 时，浏览器 Origin 与 localhost 不同，动态放行本机局域网 IP */
export const DEV_FRONTEND_ORIGINS: string[] = Array.from(
  new Set([
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    ...getLocalIpOrigins(5173),
  ])
);

