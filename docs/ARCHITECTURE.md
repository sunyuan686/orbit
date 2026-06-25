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
- **认证**：`better-auth`，邮箱 + 密码，最多注册 2 个账号（情侣专属）
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
user / session / account / verification  — better-auth 标准表
```

### entry

| 字段 | 说明 |
|------|------|
| `type` | `diary` \| `timeline` \| `message` \| `letter` |
| `author` | 创建者署名 |
| `modifiedBy` | 最后编辑者署名 |
| `body` | TipTap 输出的 HTML |
| `bodyText` | 纯文本，供 FTS 索引 |
| `entryDate` | 记录日期（Unix 时间戳） |
| `parentId` | 信件回信链 / 留言回复链 |
| `userId` | 写入时的登录用户 |
| `createdAt` / `updatedAt` / `deletedAt` | 时间戳 |

### asset

| 字段 | 说明 |
|------|------|
| `storageKey` | SHA256 前 8 位 + 扩展名（内容寻址，天然去重） |
| `entryId` | 关联文章，可为空 |

运行时由 `ASSETS_BASE_URL` + `storageKey` 拼接访问 URL，不硬存公网地址。

### 作者规范

| 规范名 | 说明 | marker 写法 |
|--------|------|-------------|
| **小圆子** | 孙远 | `author:小圆子` |
| **小麟子** | 辛麟芝 | `author:小麟子` |

历史 Markdown 导入时，`scripts/import-md.ts` 自动映射旧别名：

- → 小圆子：`sunyuan`、`孙远`
- → 小麟子：`linzhi`、`麟宝`、`辛麟芝`

`settings` 表昵称用于 UI 展示；**`entry.author` 一律存规范名**。

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
| diary / timeline / message / letter | 仅作者（`author`） | 仅作者 |
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
├── scripts/                    # 导入、迁移、校验脚本
├── content/                    # 可提交的 Markdown 内容源
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
| [CHANGELOG.md](../CHANGELOG.md) | 版本发布记录（自动生成） |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | 提交规范与文档维护 |
| [ALIGNMENT_PLAN.md](./ALIGNMENT_PLAN.md) | 历史技术对齐计划（Phase 1–4 已完成） |
| [DB_DESIGN_REVIEW.md](./DB_DESIGN_REVIEW.md) | 历史表设计 review |
