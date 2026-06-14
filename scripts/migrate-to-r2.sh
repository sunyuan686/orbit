#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# migrate-to-r2.sh
# Phase 4：把 data/assets/ 下的 305 张图片批量上传到 Cloudflare R2
#
# 使用前提：
#   1. 已执行 npx wrangler login
#   2. 已在 Cloudflare 控制台创建 R2 Bucket（名称 orbit-media）
#
# 用法：
#   bash scripts/migrate-to-r2.sh
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

ASSETS_DIR="data/assets"
BUCKET="orbit-media"
TOTAL=0
FAILED=0

if [ ! -d "$ASSETS_DIR" ]; then
  echo "错误：找不到 $ASSETS_DIR 目录"
  exit 1
fi

echo "→ 开始上传 $ASSETS_DIR 到 R2 bucket: $BUCKET"
echo ""

for filepath in "$ASSETS_DIR"/*; do
  filename=$(basename "$filepath")

  # 猜测 Content-Type
  case "${filename##*.}" in
    jpg|jpeg) mime="image/jpeg" ;;
    png)      mime="image/png" ;;
    gif)      mime="image/gif" ;;
    webp)     mime="image/webp" ;;
    heic)     mime="image/heic" ;;
    *)        mime="application/octet-stream" ;;
  esac

  if npx wrangler r2 object put "$BUCKET/$filename" \
      --file "$filepath" \
      --content-type "$mime" \
      --cache-control "public, max-age=31536000, immutable" 2>/dev/null; then
    TOTAL=$((TOTAL + 1))
    echo "  ✓ $filename"
  else
    FAILED=$((FAILED + 1))
    echo "  ✗ $filename (失败)"
  fi
done

echo ""
echo "✓ 完成：上传 $TOTAL 张，失败 $FAILED 张"

# ─── 可选：更新 DB 中 asset.url 字段 ─────────────────────────────────────────
# 如果 R2 已开启 Public Bucket，可以取消下面注释并填入公网域名：
#
# R2_PUBLIC_URL="https://pub-xxx.r2.dev"
# sqlite3 data/orbit.db "UPDATE asset SET url = replace(url, '/assets/', '${R2_PUBLIC_URL}/')"
# sqlite3 data/orbit.db "UPDATE entry SET body = replace(body, '![](assets/', '![]($R2_PUBLIC_URL/')  WHERE body LIKE '%![](assets/%'"
#
# 注意：上面的 UPDATE 会更新本地 SQLite。D1 的 URL 需要通过 wrangler d1 execute 执行
