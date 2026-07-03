/**
 * better-auth 的 baseURL 必须是浏览器实际访问的前端地址。
 * 本地 dev：Vite 在 5173，API 经代理转发到 3001，Origin 仍是 5173。
 * 生产：Worker 同域提供前端与 API，通过 BETTER_AUTH_URL 注入。
 */
export const AUTH_BASE_URL =
  process.env.BETTER_AUTH_URL ?? "http://localhost:5173";

/** 本地 Vite 绑定 127.0.0.1 时，浏览器 Origin 与 localhost 不同，需一并放行 */
export const DEV_FRONTEND_ORIGINS = [
  "http://localhost:5173",
  "http://127.0.0.1:5173",
] as const;
