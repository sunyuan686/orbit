# Orbit 技术对齐计划

参考 [Jant](https://github.com/jant-me/jant) 项目，系统性升级 Orbit 的技术架构。

---

## 一、现状问题


| 问题     | 现状                            |
| ------ | ----------------------------- |
| 数据存储   | 一个大 `.md` 文件装所有内容，无法查询、搜索、排序  |
| 图片存储   | 本地磁盘 `data/assets/`，换设备图片全部失效 |
| 两人访问   | 只能 localhost，异地无法共同使用         |
| 编辑体验   | 无编辑器，手写 Markdown              |
| AI 集成  | 无 API / MCP，AI 无法直接操作内容       |
| Bot 记录 | 未实现，随手记录靠手动                   |
| 数据备份   | 无自动备份，靠手动复制                   |


---

## 二、目标架构

```
浏览器 UI（React + TipTap）
        ↕ fetch
Hono Server（Cloudflare Workers）
        ↕ Drizzle ORM
    D1 SQLite 数据库
        +
    R2 对象存储（图片）
        +
    GitHub 双向同步（备份）
        +
Telegram Bot（随手记录）
        +
MCP 端点（AI 操作）
```

---

## 三、数据库设计（4 张表）

### `entry` — 核心内容表

```sql
CREATE TABLE entry (
  id           TEXT PRIMARY KEY,          -- nanoid，如 "ent_k3m9x2"
  type         TEXT NOT NULL,             -- diary | message | letter
  author       TEXT NOT NULL,             -- sunyuan | linzhi（仅署名，不做权限控制）
  title        TEXT,                      -- 可选标题
  body         TEXT,                      -- Markdown 原文（AI 可读写）
  body_html    TEXT,                      -- 预渲染 HTML（展示用）
  body_text    TEXT,                      -- 纯文本（全文搜索索引）
  entry_date   INTEGER,                   -- 记录日期（Unix 时间戳），区别于写入时间
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER                    -- 软删除
);
```

### `asset` — 图片/文件表

```sql
CREATE TABLE asset (
  id           TEXT PRIMARY KEY,
  entry_id     TEXT REFERENCES entry(id), -- 可为空（相册封面等独立图片）
  storage_key  TEXT NOT NULL,             -- R2 object key
  url          TEXT NOT NULL,             -- 公网访问 URL
  mime_type    TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  size         INTEGER,                   -- 字节数
  position     TEXT NOT NULL DEFAULT 'a0',-- 排序位置（分数索引）
  created_at   INTEGER NOT NULL
);
```

### `memo` — 备忘录（长期维护的文档）

```sql
CREATE TABLE memo (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,      -- about_sunyuan | about_linzhi | rules | ...
  title        TEXT NOT NULL,
  body         TEXT,
  body_html    TEXT,
  updated_at   INTEGER NOT NULL
);
```

### `settings` — 全局配置

```sql
CREATE TABLE settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- 预置 key：
-- anniversary_date    纪念日
-- sunyuan_nickname    小圆子
-- linzhi_nickname     小辛星
-- theme               主题色
```

---

## 四、从 Jant 借鉴的功能模块

### 4.1 认证系统 — `better-auth`

参考：`packages/core/src/auth.ts`

- 邮箱 + 密码登录
- Session 管理、Cookie、密码哈希全部内置
- **改动**：允许注册前 2 个用户，之后关闭注册

```ts
// 原 Jant：只允许 1 个用户
if (existing.length > 0) throw ...

// Orbit 改为：允许 2 个用户
if (existing.length >= 2) throw ...
```

author 字段仅用于署名，两人权限完全对等。

---

### 4.2 图片上传 — R2 + 内容寻址

参考：`src/lib/storage.ts` + `routes/api/upload.ts`

- 上传到 Cloudflare R2
- 文件名继续沿用 SHA256 前 8 位（Orbit 现有逻辑）
- 本地开发走本地存储，生产走 R2，通过 `StorageDriver` 抽象切换
- `asset` 表记录 `storage_key` 和公网 `url`

---

### 4.3 编辑器 — TipTap

参考：`src/client/tiptap/`

替换现有文本框，核心能力：

- 粘贴截图 / 拖拽图片 → 自动上传 R2，插入图片
- `/` 斜杠命令菜单
- Markdown 快捷输入（`**bold**`、`# 标题`）
- 选中文字弹出格式工具栏

---

### 4.4 部署 — Cloudflare Workers

参考：`sites/demo/wrangler.toml` + `.github/workflows/deploy.yml`

- Hono 代码无需改动（天然支持 Workers）
- D1 替代本地 SQLite（API 完全兼容）
- R2 存图片
- push 到 main 分支自动部署
- 两人随时随地访问，不依赖局域网

---

### 4.5 GitHub 双向同步

参考：`src/services/github-sync.ts` + `routes/api/github-sync.ts`

- 每次写入 `entry` → 自动 commit 到 GitHub 私有仓库
- GitHub 上的编辑 → 通过 Webhook 同步回数据库
- 仓库结构：每条记录一个 `.md` 文件，图片引用 R2 URL
- 作为完整备份，也方便 AI 直接读文件

---

### 4.6 Telegram Bot — 随手记录

参考：`src/routes/api/telegram.ts`

- 给 Bot 发文字 → 自动写入 `entry`（type: diary）
- 发图片 → 上传 R2，写入 `asset`，附到当天记录
- 发相册（多图）→ 合并为一条记录
- 支持指令：`/today` 查今日记录，`/summary 6月` 月度总结

---

### 4.7 MCP + API Token

参考：`src/routes/api/mcp.ts` + `src/services/api-token.ts`

- 生成 Bearer Token，供脚本和 AI 工具调用
- 暴露 MCP 端点 `/api/mcp`
- Claude / Cursor 可直接操作：查询记录、写入日记、搜索内容、总结
- 对应 README 中「支持问答、总结、编辑」的目标

---

## 五、UI / 移动端设计规范

### 样式直接复用 Jant

不自己设计样式体系，直接引入 Jant 的样式文件：

| 文件 | 用途 |
|------|------|
| `packages/core/src/styles/tokens.css` | CSS 变量（颜色、间距、字体 token） |
| `packages/core/src/styles/ui.css` | 组件样式 |
| `packages/core/src/preset.css` | Tailwind + BaseCoat 预设 |
| `references/basecoat/` | 语义组件类（`.btn`、`.card`、`.input`、`.field`、`.badge`） |

**直接复用，不改动，保持和 Jant 视觉完全一致。**

### 移动端优先

情侣日常使用场景以手机为主，移动端体验是第一优先级：

**布局**
- 单列布局，内容宽度 `max-w-2xl` 居中
- 底部固定操作栏（发布按钮、导航），拇指可达
- 避免需要横向滚动的布局

**触控**
- 所有可点击元素最小尺寸 `44×44px`（iOS HIG 标准）
- 按钮间距足够，防误触
- 列表项整行可点击，不只是文字部分

**编辑器（TipTap）移动端适配**
- 工具栏固定在键盘上方（`position: sticky` + `bottom: 0`）
- 键盘弹出时内容区自动上移，不遮挡光标
- 图片插入支持手机相机直接拍照上传
- 工具栏按钮够大，手指操作不误触

**输入体验**
- 标题输入框自动聚焦
- 表单字段 `font-size: 16px`（防止 iOS 自动缩放）

---

## 六、落地顺序

```
Phase 1：基础数据层
  ├── 4 张表 Drizzle schema（entry / asset / memo / settings）
  └── 数据迁移（现有 .md 文件导入 SQLite）

Phase 2：认证 + 基础 CRUD
  ├── better-auth 接入（参考 Jant auth.ts）
  └── entry 增删改查接口 + 基础 UI

Phase 3：编辑体验
  ├── TipTap 编辑器替换现有文本框
  ├── 移动端工具栏适配（固定在键盘上方）
  ├── 手机拍照直接上传
  └── 图片上传（先本地，后 R2）

Phase 4：云端部署
  ├── 迁移到 Cloudflare Workers + D1 + R2
  └── GitHub Actions 自动部署

Phase 5：同步与集成
  ├── GitHub 双向同步
  ├── API Token + MCP 端点
  └── Telegram Bot

Phase 6：扩展功能（暂不做）
  └── 记账、电子相册、立体书、重要节点、成长系统
```

---

## 六、参考资源

- Jant 仓库：`/Users/sunyuan/Desktop/project/jant`
- Jant 部署记录：`tasks/deployment-log.md`
- better-auth 文档：[https://www.better-auth.com](https://www.better-auth.com)
- TipTap 文档：[https://tiptap.dev](https://tiptap.dev)
- Drizzle ORM 文档：[https://orm.drizzle.team](https://orm.drizzle.team)
- Cloudflare D1 文档：[https://developers.cloudflare.com/d1](https://developers.cloudflare.com/d1)

