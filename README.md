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

**数据库运维与安全发布**

本地启动服务会自动触发 `safeMigrate`（检测到增量迁移时会自动先做物理备份）。常用高频命令如下：

| 命令 | 场景 | 说明 |
| :--- | :--- | :--- |
| `npm run db:backup` | 本地备份 | 刷盘并导出本地 SQLite 物理快照至 `data/backups/` |
| `npm run db:restore` | 本地还原 | 查看备份列表；后接备份文件路径一键无损还原 |
| `npm run db:backup:remote` | 线上备份 | 导出 Cloudflare D1 生产库全部实体表 SQL 快照 |
| `npm run db:migrate:remote`| 线上发布 | **安全迁移**：强制先自动导出远程快照，再应用 D1 迁移 |
| `npm run db:search-status` | 索引诊断 | 检查全文搜索 FTS5 索引健康状态 |

**常用检查**

```bash
npm run typecheck
npm run web:build
npm run web:lint
```

**部署到 Cloudflare（生产环境）**

所有仓库使用相同的 `wrangler.toml` 模板和 workflow，不把实际部署参数写入 Git。

GitHub Actions 配置：

| 位置 | 参数 |
| --- | --- |
| Repository Variables | `ORBIT_D1_DATABASE_ID`、`ORBIT_SITE_URL`（HTTPS 域名地址）、`ORBIT_VAPID_PUBLIC_KEY`（不启用 Web Push 时留空） |
| Repository Secrets | `CF_ACCOUNT_ID`、`CF_API_TOKEN`、`VITE_TURNSTILE_SITE_KEY` |
| 执行开关 | 部署仓库设置 `ENABLE_DEPLOY=true`；唯一发版仓库设置 `ENABLE_RELEASE=true`，其余仓库保持关闭 |

启用部署后，push 到 `main` 会生成被 Git 忽略的 `wrangler.local.toml`，完成前端构建、D1 前置备份与增量迁移，再发布 Worker。Worker 密钥（如 `BETTER_AUTH_SECRET`、`TURNSTILE_SECRET_KEY`、`VAPID_PRIVATE_KEY`）通过 Cloudflare Secrets 配置。

本地部署：将 `.env.example` 中的三个 `ORBIT_*` 参数填写到 `.env.deploy.local`，依次运行 `npm run web:build`、`npm run db:migrate:remote` 和 `npm run deploy`。单独生成配置用 `npm run deploy:config`；手动 Wrangler 命令须加 `--config wrangler.local.toml`。远程数据库 npm 脚本会自动生成并使用该配置。

发版沿用 private 作为唯一来源，public 同步版本文件。release-please 自动生成 CHANGELOG 后，会移除依赖特定仓库提交、PR 和比较页面的链接，保留版本与变更说明；同步时不再改写文件。

---

## 功能概览

Orbit 包含七类记录内容：**日记**、**随想**（轻量短动态）、**感谢**（暖心卡片与徽章）、**时间线**、**留言板**、**信箱**、**备忘录**，并提供**恋爱记忆**（星图/图鉴/里程碑）。配备 TipTap 富文本编辑、拍立得视图切换、图片上传（SHA256 去重）、FTS5 全文搜索、行内边注评论等能力。

👉 完整功能状态与迭代计划见 **[ROADMAP.md](ROADMAP.md)**

---

## 技术栈（摘要）

React + Vite · TipTap · Hono · Drizzle ORM · SQLite / Cloudflare D1 · R2 · better-auth

👉 详细架构见 **[ARCHITECTURE.md](ARCHITECTURE.md)**
