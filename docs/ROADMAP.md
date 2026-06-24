# Orbit 功能路线图

> **单一进度源**：功能状态以此文档为准。
>
> 版本发布记录见 [CHANGELOG.md](../CHANGELOG.md)，
>
> 架构说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
>
> 最后更新：2026-06-25 · 当前版本：[v0.0.1](../CHANGELOG.md#001---2026-06-24)

---

## 状态说明


| 标记  | 含义                 |
| --- | ------------------ |
| ✅   | 已完成，已合并 main，可日常使用 |
| 🚧  | 进行中（可附 PR 链接）      |
| 📋  | 已规划，尚未开工           |
| 💡  | 有方向，未排期            |
| ⚠️  | 部分实现，见说明列          |
| ❌   | 明确不做               |


---

## 阶段总览


| 阶段        | 名称     | 状态  | 说明                                          |
| --------- | ------ | --- | ------------------------------------------- |
| Phase 1–4 | 核心平台   | ✅   | 数据层、认证、CRUD、TipTap、Cloudflare 部署            |
| Phase A   | 体验补齐   | 🚧  | 元数据展示、设计风格已落地；设置页、审计日志、PWA 待做                          |
| Phase B   | 外部集成   | 📋  | API Token、GitHub 同步、MCP、Telegram Bot、飞书 Bot |
| Phase C   | 协作增强   | 📋  | 版本历史、双人联署、消息通知                              |
| Phase D   | AI 与扩展 | 💡  | AI 聊天助手、智能总结、恋爱地图、共同爱好等                             |
| Phase E   | 可视化趣味  | 💡  | 热力图、相册、记账、立体书                               |


---

## 内容分类


| 功能         | 状态  | 说明                   | 相关代码                                  |
| ---------- | --- | -------------------- | ------------------------------------- |
| 📖 日记      | ✅   | 列表、CRUD、日期、富文本、图片    | `entry.type=diary`，`web/src/pages/`   |
| 💫 时间线     | ✅   | 里程碑记录，与日记同构          | `entry.type=timeline`                 |
| 💬 留言板     | ✅   | 两人互留文字               | `entry.type=message`                  |
| ✉️ 信箱 / 信件 | ✅   | 主信 + 回信树（`parentId`） | `entry.type=letter`，`ArticleList.tsx` |
| 📌 备忘录     | ✅   | 长期维护文档，按 `key` 访问    | `memo` 表，`/memo`                      |


---

## 编辑与媒体


| 功能         | 状态  | 说明                     | 相关代码                                          |
| ---------- | --- | ---------------------- | --------------------------------------------- |
| TipTap 富文本 | ✅   | 标题、列表、引用、格式工具栏         | `web/src/components/TiptapEditor.tsx`         |
| 图片上传       | ✅   | 粘贴 / 拖拽 / 按钮，SHA256 去重 | `src/api/assets.ts`                           |
| HEIC 转换    | ✅   | iPhone 照片自动转换          | `heic-convert` + `sharp`                      |
| 双存储        | ✅   | 本地磁盘 / Cloudflare R2   | `src/server/routes/assets.ts`，`src/worker.ts` |


---

## 评论


| 功能      | 状态  | 说明                 | 相关代码                                       |
| ------- | --- | ------------------ | ------------------------------------------ |
| 底部评论    | ✅   | 嵌套回复一层，按类型开放       | `src/api/comments.ts`                      |
| 选中文字边注  | ✅   | 混合锚定，编辑时自动重映射      | `web/src/lib/anchor.ts`，`CommentHighlight` |
| 评论编辑 UI | ⚠️  | 后端 API 已有，前端未接编辑入口 | `PUT /api/comments/:id`                    |


各类型评论能力见 [ARCHITECTURE.md#评论能力矩阵](./ARCHITECTURE.md#评论能力矩阵)。

---

## 搜索


| 功能     | 状态  | 说明                         | 相关代码                       |
| ------ | --- | -------------------------- | -------------------------- |
| 全文搜索   | ✅   | FTS5 + trigram，中文友好        | `src/services/search.ts`   |
| 搜索页    | ✅   | `/search`，顶栏快捷搜索           | `web/src/pages/Search.tsx` |
| 高级中文分词 | 💡  | 当前 trigram 已够用，jieba 级分词待定 | —                          |


---

## 平台能力


| 功能            | 状态  | 说明                      | 相关代码                            |
| ------------- | --- | ----------------------- | ------------------------------- |
| 邮箱密码登录        | ✅   | better-auth             | `src/auth.ts`                   |
| 情侣专属（≤2 账号）   | ✅   | 注册硬限                    | `src/auth.ts`                   |
| 作者规范名         | ✅   | 小圆子 / 小麟子               | `src/authors.ts`                |
| 软删除           | ✅   | `deletedAt` 标记          | `src/db/schema.ts`              |
| 作者归属校验        | ✅   | 编辑按类型策略（memo 双方可改，其余仅作者）；删除仅作者 | `src/content-policies.ts`       |
| 双模式运行         | ✅   | Node 本地 + Cloudflare 生产 | `src/server/`，`src/worker.ts`   |
| CI/CD 部署      | ✅   | push main 自动部署          | `.github/workflows/deploy.yml`  |
| Markdown 历史导入 | ✅   | `content/` → SQLite     | `scripts/import-md.ts`          |
| 响应式 + 暗色主题    | ✅   | 移动端布局、主题切换              | `web/src/components/Layout.tsx` |
| 文章目录 TOC      | ✅   | 桌面侧栏 + 移动抽屉             | `TableOfContents.tsx`           |


---

## 设计与体验


| 功能 | 状态 | 说明 |
|------|------|------|
| 固定设计风格 | ✅ | Design Tokens + 组件规范见根目录 [DESIGN.md](../DESIGN.md) |
| Design Tokens 体系 | ✅ | `web/src/index.css` 与 `DESIGN.md` YAML 对齐；禁止组件内硬编码色值 |
| 设计规范文档 | ✅ | [DESIGN.md](../DESIGN.md)（规范源）+ [docs/DESIGN.md](./DESIGN.md)（索引） |
| 主题定制 | ⚠️ | 亮 / 暗 / 跟随系统已支持；`settings` 主题色、纪念日氛围等未接入 |


---

## 元数据与治理


| 功能            | 状态  | 说明                                             |
| ------------- | --- | ---------------------------------------------- |
| 创建 / 修改时间（DB） | ✅   | `createdAt` / `updatedAt` 已写入                  |
| 创建 / 修改时间（UI） | ✅   | 详情页展示记录日期、创建时间、最近修改时间（有编辑时） |
| 创建人 / 修改人     | ✅   | 展示作者；有编辑且修改者与作者不同时展示修改人 |
| 双人联署作者        | 📋  | 每篇仅一个 `author`；memo 通过 `couple` 编辑权限共同维护 |
| 编辑变更 / 版本历史   | 📋  | 无 revision 表、无 diff                            |
| 审计日志（持久化）     | 📋  | 仅 `console.info`，无 `audit_log` 表               |
| 全局设置页         | 📋  | `settings` 表存在，无 API / UI                      |


---

## 外部集成（Phase B）


| 功能                 | 状态  | 说明                              |
| ------------------ | --- | ------------------------------- |
| GitHub 双向同步        | 📋  | 写入自动 commit `.md`，Webhook 反向同步  |
| API Token          | 📋  | Bearer Token，供脚本 / AI 调用        |
| MCP 端点             | 📋  | `/api/mcp`，Claude / Cursor 直接操作 |
| Telegram Bot、飞书bot | 📋  | 文字→日记，图片→R2，`/today` `/summary` |


---

## AI 能力（Phase D）


| 功能 | 状态 | 说明 |
|------|------|------|
| 集成 AI 聊天助手 | 📋 | 站内对话界面（侧栏 / 浮层），基于日记、留言、备忘录等内容上下文问答；支持回忆检索、关系脉络梳理、写作灵感与润色建议；会话可关联当前文章或全局；依赖 Phase B API Token / MCP |
| 智能总结 | 💡 | 按日 / 周 / 月 / 年聚合内容，生成恋爱日记式回顾 |
| AI 辅助编辑 | 💡 | 编辑器内选中段落改写、续写、提炼标题；与边注能力可组合 |
| 模型与密钥配置 | 📋 | 支持配置 LLM 提供商与 API Key（`settings` 或环境变量），情侣空间内私有 |


---

## 扩展功能（Phase D–E）


| 功能                    | 状态  | 说明                 |
| --------------------- | --- | ------------------ |
| 恋爱地图                  | 💡  | 地点实体 + 地图可视化       |
| 共同爱好（书 / 音 / 影）       | 💡  | 新内容类型或独立表          |
| 消息通知                  | 📋  | 新内容 / 评论 / 回信推送    |
| 热力图                   | 💡  | 按日写作活跃度            |
| 电子相册                  | 💡  | 从 `asset` 聚合独立浏览   |
| 记账                    | 💡  | 独立模块               |
| 立体书                   | 💡  | 创意展示，优先级最低         |
| 移动端 APP               | 💡  | PWA 优先，原生壳待定       |


---

## 下一步（Next Up）

按优先级排列，完成一项后将状态改为 ✅ 并更新 [CHANGELOG](../CHANGELOG.md)（通过 conventional commit + release 流程）。

1. [x] 文章详情展示创建时间、最近修改时间、作者（Phase A）
2. [x] 固定设计风格：Design Tokens + 组件规范 + `DESIGN.md`（Phase A）
3. [ ] `settings` API + 设置页：纪念日、昵称、主题色（Phase A）
4. [ ] 持久化审计日志表 + 查询接口（Phase A）
5. [ ] 评论编辑 UI（Phase A）
6. [ ] API Token + REST 规范化（Phase B）

---

## 文档维护


| 变更类型        | 更新文档                                          |
| ----------- | --------------------------------------------- |
| 功能上线 / 状态变化 | 本文件（ROADMAP.md）                               |
| 版本发布        | [CHANGELOG.md](../CHANGELOG.md)（**自动生成**，勿手改） |
| 架构 / 表结构变更  | [ARCHITECTURE.md](./ARCHITECTURE.md)          |
| 提交与发布规范     | [CONTRIBUTING.md](./CONTRIBUTING.md)          |


PR 合并功能变更时，请同步更新 ROADMAP 中对应行的状态。