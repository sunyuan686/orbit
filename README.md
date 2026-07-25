# Orbit

**名字的意义**

- Orbit = 轨道/环绕
- 两人彼此吸引、围绕彼此，稳定长期有节奏
- 克制、浪漫、高级、好玩、有趣、温馨、成长、回忆、记录、点滴
- 推送、润物无声。

目标：写方便，随时随地，无压力，重设计和交互。移动端友好。数据格式通用，Agent 友好。智能、回忆。

润物无声，提醒、陪伴。

定位：通用情侣恋爱记录平台，面向开源。

---

## 文档

| 文档 | 说明 |
|------|------|
| [ROADMAP.md](ROADMAP.md) | **功能清单与迭代进度**（单一进度源） |
| [DESIGN.md](DESIGN.md) | **视觉设计标准**（Design Tokens、组件、文案；AI Agent 可读） |


---

## 如何启动

**本地开发**

```bash
npm ci
npm ci --prefix web

npm run dev        # 同时启动 Node.js Server（:3001）+ Vite 前端（:5173）

npm run server   # 仅后端
npm run web      # 仅前端
```

**数据库初始化**（首次运行自动执行 schema 迁移，无需手动操作）

```bash
npm run db:generate   # 生成 Drizzle 迁移文件
npm run db:push       # 推送 schema 到本地 SQLite
```

日常内容在应用内写入 `data/orbit.db`，以数据库为准。可选维护：

```bash
npm run db:search-status   # 检查全文搜索索引
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

## 功能概览

Orbit 支持五类内容：**日记**、**时间线**、**留言板**、**信箱**、**备忘录**，配备 TipTap 富文本编辑、图片上传、FTS5 全文搜索、行内边注评论等能力。

👉 完整功能状态与迭代计划见 **[ROADMAP.md](ROADMAP.md)**

---

## 技术栈（摘要）

React + Vite · TipTap · Hono · Drizzle ORM · SQLite / Cloudflare D1 · R2 · better-auth

👉 详细架构见 **[docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)**
