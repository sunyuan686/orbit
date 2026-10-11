# 069 - Cloudflare 资源审查与防失控加固

> 创建：2026-10-09
> 状态：已完成

## 目标

审查 Cloudflare Workers 资源与计费路径，废弃无状态的 Durable Object 定时器改用 Cron Trigger，防范 ServerlessHorrors 账单失控；修复相册鉴权漏洞、收紧 CORS 与暴露面、对外部请求施加超时限制，清理冗余依赖。

## 步骤

1. **废弃 Durable Object 并转为无状态 Cron Trigger**：
   - `wrangler.toml` 移除 `durable_objects.bindings`，保留历史 migration `v1`，追加 `v2` 设置 `deleted_classes = ["CompanionScheduler"]`；
   - `wrangler.toml` 增加 `[triggers] crons = ["0 * * * *"]`（每小时检查一次）；
   - `src/worker.ts` 导出 `scheduled(event, env, ctx)` 事件处理函数，直接调用 `runCompanionEngine` 与 `deliverCompanionCard`；
   - 移除无用的 `bootstrap` / `reschedule` / `status` DO 路由，保留 `/api/companion/test`；
   - 精简/删除 `src/services/companion/companion-scheduler.ts`。
2. **安全暴露面收敛与鉴权修复**：
   - `wrangler.toml` 顶层显式设置 `workers_dev = false` 与 `preview_urls = false`；
   - `src/worker.ts` 补齐 `/api/albums/*` 与 `/api/albums` 的 `requireAuth` 中间件（修复相册未授权读取漏洞）；
   - `src/worker.ts` 收紧 CORS origin，仅允许 `BETTER_AUTH_URL` 对应站点 及本地开发地址，禁止任意 `(origin) => origin` 反射。
3. **输入与资源上限保护**：
   - `src/api/gallery.ts`、`src/api/audit.ts`、`src/api/memories.ts` 为 `limit` 分页参数施加上限保护（如 `Math.min(limit, 100)`）；
   - `src/api/assets.ts` 增加 50MB 上传体积上限检查。
4. **外部请求超时保护**：
   - `src/services/feishu/feishu-api.ts`（飞书 API 调用）、`src/lib/vapid.ts`（Web Push）、`src/services/ai/web-search-provider.ts`（Tavily/Brave Search）、`src/lib/turnstile.ts`（Turnstile 验证）补充 `AbortSignal.timeout(10_000)`。
5. **依赖清理与版本锁定**：
   - 从 `package.json` 移除未使用的 `@ai-sdk/anthropic`，锁定 `wrangler` 等关键包版本；
   - 清理 `src/api/ai.ts` 中冗余导入。
6. **验证与文档同步**：
   - 运行 `npm run typecheck` 与 `npm run web:build`；
   - 更新 `ARCHITECTURE.md` 与相关文档。

## 完成标准（可验证）

- [x] `npm run typecheck` 与 `npm run web:build` 无错误
- [x] `npm test` 通过
- [x] `wrangler.toml` 中 `workers_dev = false`，DO 已废弃并声明 `deleted_classes`
- [x] `/api/albums` 路由具备 `requireAuth` 保护
- [x] 外部 fetch 均具备 `AbortSignal.timeout` 保护
