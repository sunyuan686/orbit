/**
 * better-auth 的 baseURL 必须是浏览器实际访问的前端地址。
 * 本地 dev：Vite 在 5173，API 经代理转发到 3001，Origin 仍是 5173。
 * 生产：Worker 同域提供前端与 API，通过 BETTER_AUTH_URL 注入。
 */
export const AUTH_BASE_URL =
  process.env.BETTER_AUTH_URL ?? "http://localhost:5173";
