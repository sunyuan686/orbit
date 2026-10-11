# Wrangler 预览地址配置导致部署预检失败

> 创建：2026-10-11 · 状态：已修复

## 现象

`wrangler deploy --dry-run` 报错：`preview_urls` 应为布尔值；同时提示 `workers_dev` 位于错误的 observability 配置层级。

## 根因与修复

TOML 的表作用域使 `workers_dev` 落入 `[observability.traces]`，且 `[preview_urls] enabled = false` 不符合 Wrangler 配置类型。将两项移至文件顶层，使用 `workers_dev = false` 和 `preview_urls = false`，保持仅通过自定义域名访问的原定配置。

## 回归验证

- 使用项目锁定的 Wrangler 4.135.0 执行 `wrangler deploy --dry-run`，确认配置校验及 Worker 打包通过。
