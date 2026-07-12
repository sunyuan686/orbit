# API Token 设计

> 供脚本、Cursor、后续 MCP 客户端以 Bearer 方式调用 Orbit 内容 API。  
> 进度见 [ROADMAP.md](../../ROADMAP.md) Phase B。

---

## 目标

| 要做 | 不做（MVP） |
|------|-------------|
| 生成长期 Bearer Token，调用现有 REST | MCP 端点（独立排期） |
| Token 以创建者 `user_id` 署名写入 | 细粒度 scope（读/写分权） |
| 设置页创建 / 列表 / 撤销 | 过期时间、自动轮换 |
| 与 Cookie 会话共用 `SessionAuthor` 解析 | Token 访问设置、账户、审计 |

---

## 架构

```
外部客户端 ──Authorization: Bearer orb_…──→ Hono 中间件
                                              │
                    ┌─────────────────────────┴─────────────────────────┐
                    │ resolveSessionAuthor                                 │
                    │   1. better-auth Cookie 会话（优先）                  │
                    │   2. api_token 表哈希校验                             │
                    └─────────────────────────┬─────────────────────────┘
                                              ▼
                                    现有 /api/* 路由（articles 等）
```

- Token 管理（`GET/POST/DELETE /api/api-tokens`）仅 Cookie 会话
- 内容 API 走 `requireAuth`（`allowApiToken: true`）
- 敏感路由走 `requireSession`（`allowApiToken: false`）

---

## Token 格式与存储

| 项 | 约定 |
|----|------|
| 明文格式 | `orb_` + 48 位十六进制（24 字节随机） |
| 入库 | 仅存 SHA-256 哈希；列表展示 `tokenPrefix`（前 12 字符） |
| 明文可见性 | 仅 `POST /api/api-tokens` 响应一次 |
| 上限 | 空间内最多 10 个未撤销 Token |
| 撤销 | 软删除 `revoked_at`；校验时拒绝 |

表：`api_token`（migration `0012_api_token.sql`）。字段说明见 [ARCHITECTURE.md](../ARCHITECTURE.md#api_token)。

---

## 鉴权矩阵

| 路由前缀 | Cookie | Bearer |
|----------|--------|--------|
| `/api/articles`、`/search`、`/comments`、`/assets`、`/gallery`、`/ai` | ✅ | ✅ |
| `/api/space`（除 `/status`） | ✅ | ✅ |
| `/api/settings`、`/account`、`/audit`、`/api-tokens` | ✅ | ❌ 403 |
| `/api/integrations`（配置）、`/notifications` | ✅ | ❌ 403 |
| `/api/auth/*`、飞书 Webhook | 各自规则 | — |

Bearer 与 Cookie 同时存在时，**优先会话**。

写入内容的作者身份与 Cookie 登录一致：`{ userId, author }` 来自 Token 创建者。

---

## 管理 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/api-tokens` | 列出有效 Token（无明文） |
| POST | `/api/api-tokens` | Body: `{ "name": "用途" }`；返回含 `token` |
| DELETE | `/api/api-tokens/:id` | 撤销 |

审计：`api_token.create`、`api_token.revoke` → `audit_log`。

---

## 设置页

`/settings?tab=api-tokens`（连接 / 集成分组）

- 创建：名称 + 一次性复制明文
- 列表：前缀、创建时间、最近使用时间
- 撤销：立即失效

组件：`web/src/components/ApiTokenSettingsPanel.tsx`

---

## 调用示例

```http
GET /api/articles?type=diary HTTP/1.1
Host: your-orbit.example.com
Authorization: Bearer orb_e275ccf798ff606da6efc8e001d9f9e9be7297bd0257c868
```

---

## 代码索引

| 模块 | 路径 |
|------|------|
| 服务层 | `src/services/api-token.ts` |
| 鉴权中间件 | `src/lib/request-auth.ts` |
| 管理路由 | `src/api/api-tokens.ts` |
| Schema | `src/db/schema.ts` → `apiToken` |

---

## 后续

| 项 | 说明 |
|----|------|
| MCP `/api/mcp` | 复用同一 Bearer 校验与 `SessionAuthor` |
| Scope | 按需拆分只读 / 读写 |
| 过期 | `expires_at` 列 + 定时清理 |

Telegram 接入优先级低于 MCP、GitHub 同步，见 [ROADMAP.md](../../ROADMAP.md)。
