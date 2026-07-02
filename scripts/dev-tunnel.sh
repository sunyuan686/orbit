#!/usr/bin/env bash
set -euo pipefail

PORT="${ORBIT_TUNNEL_PORT:-5173}"
TARGET="http://127.0.0.1:${PORT}"

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "未找到 cloudflared。安装：brew install cloudflared"
  exit 1
fi

echo "→ 将公网 HTTPS 转发到 ${TARGET}"
echo "→ 请先运行: npm run dev"
echo "→ 启动后把生成的 https://*.trycloudflare.com 写入 .env："
echo "   ORBIT_PUBLIC_URL=https://xxxx.trycloudflare.com"
echo "→ 飞书 Webhook: \${ORBIT_PUBLIC_URL}/api/integrations/feishu/events"
echo ""

exec cloudflared tunnel --url "${TARGET}"
