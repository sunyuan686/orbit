# Orbit

**名字的意义**
- Orbit = 轨道/环绕
- 两人彼此吸引、围绕彼此，稳定长期有节奏
- 克制、浪漫、高级

目标：写方便，随时随地，无压力，移动端友好。数据格式通用，AI 友好读写。

定位：通用情侣恋爱记录平台，面向开源。

---

## 如何启动

**本地开发**

```bash
cd /Users/sunyuan/Desktop/project/orbit
npm ci
npm ci --prefix web

npm run dev        # 同时启动 Node.js Server（:3001）+ Vite 前端（:5173）

npm run server   # 仅后端
npm run web      # 仅前端
```

测试环境账号密码：
sunyuan608@gmail.com
12345678

**数据库初始化**（首次运行自动执行，无需手动操作）

```bash
npm run db:generate   # 生成 Drizzle 迁移文件
npm run db:push       # 推送 schema 到本地 SQLite
npm run db:import     # 从 content/ Markdown 导入历史数据（可选）
```

**常用检查**

```bash
npm run typecheck
npm run web:build
npm run web:lint
```

**部署到 Cloudflare（生产环境）**

push 到 `main` 分支 → GitHub Actions 自动构建并部署到 Cloudflare Workers。

首次部署需在 `wrangler.toml` 中替换 `REPLACE_WITH_YOUR_D1_DATABASE_ID`，并通过 `wrangler secret put BETTER_AUTH_SECRET` 设置密钥。

---

## 功能大纲

内容分类：
- 📖 日记：时间线、日常记录（文字、图片、排版）
- 💌 留言板 / 信箱：两人互留文字
- 📌 备忘录：约定、偏好

扩展功能（规划中）：
- GitHub 双向同步（自动备份 + AI 可读）
- MCP 端点（Claude / Cursor 直接操作内容）
- Telegram Bot（随手记录）
- 记账、热力图、电子相册、立体书（待定）
- 评论（选中评论）
- 分词、搜索
- AI功能
- 恋爱地图
- 移动端APP
- 共同爱好记录（书、音、影）

---

## 架构

### 双模式运行

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

- **本地**：`src/server/index.ts`，`better-sqlite3` 驱动
- **生产**：`src/worker.ts`，Cloudflare D1 + R2 绑定
- **共享 API**：`src/api/`，Node.js Server 和 Worker 复用同一套路由
- **认证**：`better-auth`，邮箱 + 密码登录，最多注册 2 个账号（情侣专属）
- **部署**：push 到 `main` 分支自动触发 GitHub Actions → `wrangler deploy`

---

## 技术栈

| 层 | 技术 |
|---|---|
| 前端 | React + Vite（`web/`） |
| 编辑器 | TipTap（富文本，支持图片拖拽上传） |
| 路由 | React Router |
| 后端 | Hono（同时运行于 Node.js 和 Cloudflare Workers） |
| ORM | Drizzle ORM |
| 数据库 | SQLite（本地）/ Cloudflare D1（生产） |
| 图片存储 | 本地磁盘（开发）/ Cloudflare R2（生产） |
| 认证 | better-auth |
| 部署 | Cloudflare Workers + GitHub Actions |

---

## 数据库设计

```
entry      — 日记、留言、信件（软删除）
asset      — 图片 / 文件（关联 entry）
memo       — 备忘录（长期维护文档，如恋爱原则）
settings   — 全局配置（纪念日、昵称、主题色）
user / session / account / verification  — better-auth 标准表
```

字段说明：
- `entry.type`：`diary` | `timeline` | `message` | `letter`
- `entry.author`：作者，固定为 **`小圆子`** 或 **`小麟子`**（见下方「作者规范」）
- `entry.body`：TipTap 输出的 HTML
- `asset.storage_key`：文件名 = SHA256 前 8 位 + 扩展名（内容寻址，天然去重）

### 作者规范

Orbit 里所有留言、信件的 `entry.author` 只使用两个规范名：

| 规范名 | 说明 | marker 写法 |
|--------|------|-------------|
| **小圆子** | 孙远 | `author:小圆子` |
| **小麟子** | 辛麟芝 | `author:小麟子` |

历史 Markdown 导入时，`import-md.ts` 会把旧别名自动映射为规范名：

- → 小圆子：`sunyuan`、`孙远`
- → 小麟子：`linzhi`、`麟宝`、`辛麟芝`

**Marker 示例：**

```markdown
<!-- msg | date:20250810 | author:小圆子 -->

<!-- letter | round:20 | author:小麟子 | date:2024-05-19 -->
```

`settings` 表中的昵称（`sunyuan_nickname` / `linzhi_nickname`）用于 UI 展示；**数据库 `entry.author` 一律存规范名**。

---

## 目录结构

```
orbit/
├── src/                        # 后端代码
│   ├── server/                 # Node.js 本地开发 Server
│   │   ├── index.ts
│   │   ├── auth.ts             # 本地 better-auth 实例
│   │   └── routes/
│   │       ├── articles.ts     # 本地挂载共享文章路由
│   │       └── assets.ts       # 本地图片存储适配
│   ├── api/                    # Node / Worker 共享 API 路由
│   │   ├── articles.ts
│   │   └── assets.ts
│   ├── worker.ts               # Cloudflare Workers 生产入口
│   ├── db/
│   │   ├── index.ts            # 本地 SQLite / Drizzle 实例
│   │   ├── schema.ts           # Drizzle 表定义
│   │   └── migrations/         # SQL 迁移文件
│   ├── auth.ts                 # better-auth 共享配置工厂
│   └── types/                  # 本地类型声明
├── web/                        # 前端代码（Vite + React）
│   └── src/
│       ├── pages/              # ArticleList / ArticleView / ArticleEdit / Login
│       ├── components/         # Layout / TiptapEditor / MilkdownEditor
│       └── lib/api.ts          # fetch 封装
├── scripts/                    # 数据迁移、导入、校验和维护脚本
│   ├── README.md
│   ├── import-md.ts            # 从 content/ 导入到本地 SQLite
│   ├── migrate.ts              # 一次性旧资料迁移到 content/
│   ├── migrate-to-r2.sh        # 本地图片批量上传到 R2
│   ├── normalize-*.py          # 历史 Markdown 格式维护
│   └── verify-import.py        # 导入结果校验
├── content/                    # 可提交的 Markdown 内容源
│   ├── diary/
│   ├── messages/
│   ├── letters/
│   └── memo/
├── data/                       # 本地运行时数据（.gitignore 排除）
│   ├── orbit.db                # 本地 SQLite 数据库
│   └── assets/                 # 本地上传图片
├── backups/                    # 本地历史备份快照（.gitignore 排除）
├── docs/                       # 技术设计和阶段规划文档
├── drizzle.config.ts
├── package.json
├── tsconfig.json
├── wrangler.toml               # Cloudflare 部署配置
└── .github/workflows/
    └── deploy.yml              # 自动部署
```

---

## 后续规划（Phase 5）

- **GitHub 双向同步**：每次写入 `entry` 自动 commit 到私有仓库，支持 Webhook 反向同步；仓库中每条记录一个 `.md` 文件，AI 可直接读写
- **MCP 端点 + API Token**：暴露 `/api/mcp`，Claude / Cursor 可直接查询、写入、搜索内容
- **Telegram Bot**：发文字自动写入日记，发图片上传 R2，支持 `/today`、`/summary 6月` 等指令
