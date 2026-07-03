/**
 * 本地经 Cloudflare Tunnel 暴露时的公网根地址（仅 Node dev）。
 * 生产 Worker 仍用 BETTER_AUTH_URL（同域）。
 */
export function resolvePublicBaseUrl(fallback: string): string {
  const tunnel = process.env.ORBIT_PUBLIC_URL?.trim();
  if (tunnel) return tunnel.replace(/\/$/, "");
  const authUrl = process.env.BETTER_AUTH_URL?.trim();
  if (authUrl) return authUrl.replace(/\/$/, "");
  return fallback.replace(/\/$/, "");
}
