# Orbit 功能路线图

> **单一进度源**：功能状态以此文档为准。版本发布记录见 [CHANGELOG.md](../CHANGELOG.md)，架构说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
>
> 最后更新：2026-06-24 · 当前版本：[v0.0.1](../CHANGELOG.md#001---2026-06-24)

---

## 状态说明

| 标记 | 含义 |
|------|------|
| ✅ | 已完成，已合并 main，可日常使用 |
| 🚧 | 进行中（可附 PR 链接） |
| 📋 | 已规划，尚未开工 |
| 💡 | 有方向，未排期 |
| ⚠️ | 部分实现，见说明列 |
| ❌ | 明确不做 |

---

## 阶段总览

| 阶段 | 名称 | 状态 | 说明 |
|------|------|------|------|
| Phase 1–4 | 核心平台 | ✅ | 数据层、认证、CRUD、TipTap、Cloudflare 部署 |
| Phase A | 体验补齐 | 📋 | 元数据展示、设置页、审计日志、PWA |
| Phase B | 外部集成 | 📋 | API Token、GitHub 同步、MCP、Telegram Bot |
| Phase C | 协作增强 | 📋 | 版本历史、双人联署、消息通知 |
| Phase D | AI 与扩展 | 💡 | 智能总结、恋爱地图、共同爱好等 |
| Phase E | 可视化趣味 | 💡 | 热力图、相册、记账、立体书 |

---

## 内容分类

| 功能 | 状态 | 说明 | 相关代码 |
|------|------|------|----------|
| 📖 日记 | ✅ | 列表、CRUD、日期、富文本、图片 | `entry.type=diary`，`web/src/pages/` |
| 💫 时间线 | ✅ | 里程碑记录，与日记同构 | `entry.type=timeline` |
| 💬 留言板 | ✅ | 两人互留文字 | `entry.type=message` |
| ✉️ 信箱 / 信件 | ✅ | 主信 + 回信树（`parentId`） | `entry.type=letter`，`ArticleList.tsx` |
| 📌 备忘录 | ✅ | 长期维护文档，按 `key` 访问 | `memo` 表，`/memo` |

---

## 编辑与媒体

| 功能 | 状态 | 说明 | 相关代码 |
|------|------|------|----------|
| TipTap 富文本 | ✅ | 标题、列表、引用、格式工具栏 | `web/src/components/TiptapEditor.tsx` |
| 图片上传 | ✅ | 粘贴 / 拖拽 / 按钮，SHA256 去重 | `src/api/assets.ts` |
| HEIC 转换 | ✅ | iPhone 照片自动转换 | `heic-convert` + `sharp` |
| 双存储 | ✅ | 本地磁盘 / Cloudflare R2 | `src/server/routes/assets.ts`，`src/worker.ts` |

---

## 评论

| 功能 | 状态 | 说明 | 相关代码 |
|------|------|------|----------|
| 底部评论 | ✅ | 嵌套回复一层，按类型开放 | `src/api/comments.ts` |
| 选中文字边注 | ✅ | 混合锚定，编辑时自动重映射 | `web/src/lib/anchor.ts`，`CommentHighlight` |
| 评论编辑 UI | ⚠️ | 后端 API 已有，前端未接编辑入口 | `PUT /api/comments/:id` |

各类型评论能力见 [ARCHITECTURE.md#评论能力矩阵](./ARCHITECTURE.md#评论能力矩阵)。

---

## 搜索

| 功能 | 状态 | 说明 | 相关代码 |
|------|------|------|----------|
| 全文搜索 | ✅ | FTS5 + trigram，中文友好 | `src/services/search.ts` |
| 搜索页 | ✅ | `/search`，顶栏快捷搜索 | `web/src/pages/Search.tsx` |
| 高级中文分词 | 💡 | 当前 trigram 已够用，jieba 级分词待定 | — |

---

## 平台能力

| 功能 | 状态 | 说明 | 相关代码 |
|------|------|------|----------|
| 邮箱密码登录 | ✅ | better-auth | `src/auth.ts` |
| 情侣专属（≤2 账号） | ✅ | 注册硬限 | `src/auth.ts` |
| 作者规范名 | ✅ | 小圆子 / 小麟子 | `src/authors.ts` |
| 软删除 | ✅ | `deletedAt` 标记 | `src/db/schema.ts` |
| 作者归属校验 | ✅ | 仅可编辑自己的内容 | `src/api/articles.ts` |
| 双模式运行 | ✅ | Node 本地 + Cloudflare 生产 | `src/server/`，`src/worker.ts` |
| CI/CD 部署 | ✅ | push main 自动部署 | `.github/workflows/deploy.yml` |
| Markdown 历史导入 | ✅ | `content/` → SQLite | `scripts/import-md.ts` |
| 响应式 + 暗色主题 | ✅ | 移动端布局、主题切换 | `web/src/components/Layout.tsx` |
| 文章目录 TOC | ✅ | 桌面侧栏 + 移动抽屉 | `TableOfContents.tsx` |

---

## 元数据与治理

| 功能 | 状态 | 说明 |
|------|------|------|
| 创建 / 修改时间（DB） | ✅ | `createdAt` / `updatedAt` 已写入 |
| 创建 / 修改时间（UI） | 📋 | 文章详情页未展示 |
| 创建人 / 修改人 | ⚠️ | 有 `author` + `userId`，无 `modifiedBy`，UI 未展示修改人 |
| 双人联署作者 | 📋 | 每篇仅一个 `author` |
| 编辑变更 / 版本历史 | 📋 | 无 revision 表、无 diff |
| 审计日志（持久化） | 📋 | 仅 `console.info`，无 `audit_log` 表 |
| 全局设置页 | 📋 | `settings` 表存在，无 API / UI |

---

## 外部集成（Phase B）

| 功能 | 状态 | 说明 |
|------|------|------|
| GitHub 双向同步 | 📋 | 写入自动 commit `.md`，Webhook 反向同步 |
| API Token | 📋 | Bearer Token，供脚本 / AI 调用 |
| MCP 端点 | 📋 | `/api/mcp`，Claude / Cursor 直接操作 |
| Telegram Bot | 📋 | 文字→日记，图片→R2，`/today` `/summary` |

---

## 扩展功能（Phase D–E）

| 功能 | 状态 | 说明 |
|------|------|------|
| AI 功能（总结 / 问答 / 辅助编辑） | 💡 | 依赖 MCP + API Token |
| 恋爱地图 | 💡 | 地点实体 + 地图可视化 |
| 共同爱好（书 / 音 / 影） | 💡 | 新内容类型或独立表 |
| 消息通知 | 📋 | 新内容 / 评论 / 回信推送 |
| 热力图 | 💡 | 按日写作活跃度 |
| 电子相册 | 💡 | 从 `asset` 聚合独立浏览 |
| 记账 | 💡 | 独立模块 |
| 立体书 | 💡 | 创意展示，优先级最低 |
| 移动端 APP | 💡 | PWA 优先，原生壳待定 |

---

## 下一步（Next Up）

按优先级排列，完成一项后将状态改为 ✅ 并更新 [CHANGELOG](../CHANGELOG.md)（通过 conventional commit + release 流程）。

1. [ ] 文章详情展示创建时间、最近修改时间、作者（Phase A）
2. [ ] `settings` API + 设置页：纪念日、昵称、主题色（Phase A）
3. [ ] 持久化审计日志表 + 查询接口（Phase A）
4. [ ] 评论编辑 UI（Phase A）
5. [ ] API Token + REST 规范化（Phase B）

---

## 文档维护

| 变更类型 | 更新文档 |
|----------|----------|
| 功能上线 / 状态变化 | 本文件（ROADMAP.md） |
| 版本发布 | [CHANGELOG.md](../CHANGELOG.md)（**自动生成**，勿手改） |
| 架构 / 表结构变更 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 提交与发布规范 | [CONTRIBUTING.md](./CONTRIBUTING.md) |

PR 合并功能变更时，请同步更新 ROADMAP 中对应行的状态。
