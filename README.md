# Orbit

> **Orbit（轨道）**：两人彼此吸引、围绕彼此，稳定、长期且有节奏地前行。

Orbit 是一款**开源的通用情侣恋爱记录平台**。我们致力于打造一个克制、浪漫、高级且充满温度的专属空间，陪你记录日常点滴、共同成长与美好回忆。

### 核心理念与产品特性

* **无压力记录，随时随地**：针对移动端友好度与重设计交互深入打磨，让随时随地记录日记、时间线与信件变得极其轻量与无负担。
* **润物无声，智能陪伴**：融入温柔提醒与记忆回响机制，不打扰、不繁琐，在日常中提供细水长流般的温暖陪伴。
* **设计至上，克制浪漫**：融合高级视觉美学与丰富趣味交互，让每一次记录与浏览都充满仪式感。
* **通用数据，Agent 友好**：采用通用、开放的数据格式，原生支持 AI Agent 协作与智能检索，让记忆不仅能永久沉淀，更可被智能唤醒。

---

## 核心文档

| 文档 | 说明 |
|------|------|
| [ROADMAP.md](ROADMAP.md) | **功能清单与迭代进度**（单一进度源） |
| [ARCHITECTURE.md](ARCHITECTURE.md) | **系统架构与数据库设计**（双模式运行、表结构与权限矩阵） |
| [DESIGN.md](DESIGN.md) | **视觉设计标准**（Design Tokens、组件、文案规范） |

---

## 如何启动

**本地开发**

```bash
npm ci
npm ci --prefix web

npm run dev        # 同时启动 Node.js Server（:3001）+ Vite 前端（:5173）

npm run server     # 仅后端
npm run web        # 仅前端
```

**数据库**

服务启动时会自动运行 SQLite 数据库迁移并创建 `data/orbit.db`，无需手动初始化。

可选维护命令：

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

Orbit 包含七类记录内容：**日记**、**随想**（轻量短动态）、**感谢**（暖心卡片与徽章）、**时间线**、**留言板**、**信箱**、**备忘录**，并提供**恋爱记忆**（星图/图鉴/里程碑）。配备 TipTap 富文本编辑、拍立得视图切换、图片上传（SHA256 去重）、FTS5 全文搜索、行内边注评论等能力。

👉 完整功能状态与迭代计划见 **[ROADMAP.md](ROADMAP.md)**

---

## 技术栈（摘要）

React + Vite · TipTap · Hono · Drizzle ORM · SQLite / Cloudflare D1 · R2 · better-auth

👉 详细架构见 **[ARCHITECTURE.md](ARCHITECTURE.md)**
