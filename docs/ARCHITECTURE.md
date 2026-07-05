# Orbit 架构说明

> 描述系统如何运行、技术选型与目录结构。功能进度见 [ROADMAP.md](./ROADMAP.md)，版本发布见 [CHANGELOG.md](../CHANGELOG.md)。

---

## 双模式运行

```
本地开发：
浏览器 UI ──fetch──→ Node.js Server（Hono, :3001）──Drizzle──→ SQLite（data/orbit.db）
                                                                ↑
                                                       本地磁盘图片（data/assets/）

生产部署：
浏览器 UI ──fetch──→ Cloudflare Worker（Hono）──Drizzle──→ D1 数据库
                                                       ↑
                                                    R2 对象存储（图片）
```

| 环境 | 入口 | 数据库 | 图片存储 |
|------|------|--------|----------|
| 本地 | `src/server/index.ts` | SQLite（`better-sqlite3`） | `data/assets/` |
| 生产 | `src/worker.ts` | Cloudflare D1 | Cloudflare R2 |

- **共享 API**：`src/api/`，Node.js Server 与 Worker 复用同一套路由
- **认证**：`better-auth`，邮箱 + 密码，最多 2 个账号（情侣专属）；开通与署名见 [SPACE-ONBOARDING.md](./SPACE-ONBOARDING.md)
- **部署**：push 到 `main` → GitHub Actions 自动 `wrangler deploy`（见 `.github/workflows/deploy.yml`）

---

## 技术栈

| 层 | 技术 |
|----|------|
| 前端 | React + Vite（`web/`） |
| 编辑器 | TipTap（富文本，图片拖拽/粘贴上传） |
| 路由 | React Router |
| 后端 | Hono（Node.js + Cloudflare Workers） |
| ORM | Drizzle ORM |
| 数据库 | SQLite（本地）/ Cloudflare D1（生产） |
| 图片存储 | 本地磁盘（开发）/ Cloudflare R2（生产） |
| 认证 | better-auth |
| 搜索 | SQLite FTS5 + trigram 分词 |
| 部署 | Cloudflare Workers + GitHub Actions |

---

## 数据库设计

表定义：`src/db/schema.ts`

```
entry      — 日记、时间线、留言、信件（软删除）
asset      — 图片 / 文件（关联 entry）
memo       — 备忘录（长期维护文档）
comment    — 底部评论 + 行内边注
settings   — 全局配置（纪念日、主题色 accent 等）；空间档案 `GET/PUT /api/space`，偏好 `GET/PUT /api/settings`
audit_log  — 操作审计（创建 / 编辑 / 删除 / 评论 / 空间与设置变更 / API Token）；`GET /api/audit`
api_token  — 外部访问 Bearer Token（仅存哈希）；`GET/POST/DELETE /api/api-tokens`（管理需会话）
ai_conversation / ai_message  — AI 聊天会话与消息（见 [AI.md](./AI.md)）
user / session / account / verification  — better-auth 标准表
```

### entry

| 字段 | 说明 |
|------|------|
| `type` | `diary` \| `timeline` \| `message` \| `letter` |
| `userId` | **作者身份**（`user.id`）；权限与通知关联以此为准 |
| `author` | 冗余爱称（写入时同步 `user.name`）；FTS / 兼容用；**展示**由 `userId` → `user.name` resolve，见 [SPACE-ONBOARDING.md](./SPACE-ONBOARDING.md) |
| `modifiedByUserId` | 最后编辑者身份（**待 migration 补列**） |
| `modifiedBy` | 冗余爱称；展示由 `modifiedByUserId` → `user.name` resolve |
| `body` | TipTap 输出的 HTML |
| `bodyText` | 纯文本，供 FTS 索引 |
| `entryDate` | 记录日期（Unix 时间戳） |
| `parentId` | 信件回信链 / 留言回复链 |
| `createdAt` / `updatedAt` / `deletedAt` | 时间戳 |

### asset

| 字段 | 说明 |
|------|------|
| `storageKey` | SHA256 前 8 位 + 扩展名（内容寻址，天然去重） |
| `entryId` | 关联文章，可为空 |

运行时由 `ASSETS_BASE_URL` + `storageKey` 拼接访问 URL，不硬存公网地址。

### audit_log

| 字段 | 说明 |
|------|------|
| `action` | `article.create` \| `article.update` \| `article.delete` \| `comment.*` \| `space.update` \| `settings.update` |
| `resourceType` | `entry` \| `memo` \| `comment` \| `space` \| `settings` |
| `resourceId` | 目标 ID（空间 / 设置固定为 `space` / `settings`） |
| `metadata` | JSON 扩展字段（如 `contentType`、`bodyLength`） |
| `requestId` | 关联 HTTP 请求短 ID |
| `author` / `userId` | 操作者 |

查询：`GET /api/audit?limit=&offset=&action=&resourceType=&resourceId=&since=`（需登录）。

### api_token

| 字段 | 说明 |
|------|------|
| `tokenHash` | SHA-256 哈希，明文仅在创建时返回一次 |
| `tokenPrefix` | 展示用前缀（如 `orb_a1b2c3d4`） |
| `userId` / `author` | 创建者与署名；API 请求以此身份写入内容 |
| `lastUsedAt` / `revokedAt` | 最近使用 / 撤销时间 |

管理：`GET/POST/DELETE /api/api-tokens`（仅 Cookie 会话）。内容 API 支持 `Authorization: Bearer orb_…`（设置、账户、审计、Token 管理仍须会话）。

### memo

| 字段 | 说明 |
|------|------|
| `userId` | 创建者身份（**待 migration 补列**） |
| `author` | 冗余爱称 |
| `modifiedByUserId` | 最后编辑者身份（**待 migration 补列**） |
| `modifiedBy` | 冗余爱称 |

### comment

| 字段 | 说明 |
|------|------|
| `userId` | 评论者身份 |
| `author` | 冗余爱称 |

### notification

| 字段 | 说明 |
|------|------|
| `recipientUserId` / `actorUserId` | 收件人 / 发起人身份（**待 migration 补列**） |
| `recipient` / `actor` | 冗余爱称，双写 |

### ai_message

| 字段 | 说明 |
|------|------|
| `userId` | 用户消息发送者（**待 migration 补列**；`assistant`/`tool` 为 NULL） |
| `author` | 冗余爱称 |

### 作者与爱称

空间内作者以 `user.id` + `user.name`（爱称）为准；各业务表 `user_id` 与 `author` **双写**。开通、邀请、改爱称见 [SPACE-ONBOARDING.md](./SPACE-ONBOARDING.md)。

存量实例规范名「小圆子 / 小麟子」及别名映射见 `src/authors.ts`（迁移回填用）。

---

## 评论能力矩阵

配置：`src/comment-capabilities.ts`

| 内容类型 | 底部评论 | 行内边注 |
|----------|----------|----------|
| diary | ✅ | ✅ |
| timeline | ✅ | ✅ |
| memo | ✅ | ✅ |
| letter | ❌ | ✅ |
| message | ❌ | ❌ |

行内边注采用混合锚定（位置 + 文本 + 上下文），编辑正文时自动重映射：`web/src/lib/anchor.ts`。

### 编辑权限矩阵

配置：`src/content-policies.ts`（前端镜像：`web/src/lib/contentPolicies.ts`）

| 内容类型 | 编辑 | 删除 |
|----------|------|------|
| diary / timeline / message / letter | 仅作者（`userId`） | 仅作者 |
| memo | 双方（`couple`） | 仅作者 |

新增类型时改 `editScopeByType` 配置即可，无需散落 `if` 分支。

---

## 目录结构

```
orbit/
├── src/                        # 后端
│   ├── server/                 # Node.js 本地开发 Server
│   ├── api/                    # Node / Worker 共享 API
│   ├── worker.ts               # Cloudflare Workers 入口
│   ├── db/                     # Drizzle schema + migrations
│   ├── auth.ts                 # better-auth 配置
│   └── services/               # 搜索等业务逻辑
├── web/                        # React 前端
│   └── src/
│       ├── pages/
│       ├── components/
│       └── lib/
├── scripts/                    # 运维脚本（搜索状态、R2 上传等）
├── content/                    # Markdown 归档（不自动同步 DB）
├── docs/                       # 项目文档
├── data/                       # 本地运行时（.gitignore）
├── drizzle.config.ts
├── wrangler.toml
└── .github/workflows/
    ├── deploy.yml              # 生产部署
    └── release.yml             # 版本发布 + CHANGELOG
```

---

## 相关文档

| 文档 | 用途 |
|------|------|
| [ROADMAP.md](./ROADMAP.md) | 功能清单与迭代计划 |
| [AI.md](./AI.md) | AI 集成设计（Vercel AI SDK + Workers AI） |
| [CHANGELOG.md](../CHANGELOG.md) | 版本发布记录（自动生成） |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 提交规范与文档维护 |
| [ALIGNMENT_PLAN.md](./ALIGNMENT_PLAN.md) | 历史技术对齐计划（Phase 1–4 已完成） |
| [DB_DESIGN_REVIEW.md](./DB_DESIGN_REVIEW.md) | 历史表设计 review |
