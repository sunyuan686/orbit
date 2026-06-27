# Orbit 功能路线图

> **单一进度源**：功能状态以此文档为准。
>
> 版本发布记录见 [CHANGELOG.md](../CHANGELOG.md)，
>
> 架构说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
>
> 最后更新：2026-06-28 · 当前版本：[v0.0.1](../CHANGELOG.md#001---2026-06-24)

---

## 状态说明


| 标记  | 含义                 |
| --- | ------------------ |
| ✅   | 已完成，已合并 main，可日常使用 |
| 🚧  | 进行中                |
| 📋  | 已规划，尚未开工           |
| 💡  | 有方向，未排期            |
| ⚠️  | 部分实现，见说明列          |
| ❌   | 明确不做               |


---

## 阶段总览


| 阶段        | 名称     | 状态  | 说明                                                    |
| --------- | ------ | --- | ----------------------------------------------------- |
| Phase 1–4 | 核心平台   | ✅   | 数据层、认证、CRUD、TipTap、Cloudflare 部署                      |
| Phase A   | 体验补齐   | 🚧  | 审计日志、结构化日志、评论编辑 UI 已落地；组件细节打磨（按钮/动效/图标）**进行中**；PWA 待做 |
| Phase B   | 外部集成   | 📋  | API Token、GitHub 同步、MCP、Telegram Bot、飞书 Bot           |
| Phase C   | 协作增强   | 📋  | 版本历史、双人联署、消息通知                                        |
| Phase D   | AI 与扩展 | 🚧  | AI 聊天助手与模型配置 MVP 已落地；智能总结、恋爱地图、共同爱好等待做               |
| Phase E   | 可视化趣味  | 💡  | 热力图、相册、记账、立体书、彩蛋惊喜                                    |


---



## 内容分类


| 功能         | 状态  | 说明                   | 相关代码                                  |
| ---------- | --- | -------------------- | ------------------------------------- |
| 📖 日记      | ✅   | 列表、CRUD、日期、富文本、图片    | `entry.type=diary`，`web/src/pages/`   |
| 💫 时间线     | ✅   | 里程碑记录，与日记同构          | `entry.type=timeline`                 |
| 💬 留言板     | ✅   | 两人互留文字               | `entry.type=message`                  |
| ✉️ 信箱 / 信件 | ✅   | 主信 + 回信树（`parentId`）；列表按轮折叠往来、详情「本轮通信」时间线、写回信 | `LetterThreadPanel.tsx`，`letterThread.ts`，`ArticleList.tsx` |
| ✉️ 信件仪式感呈现 | 💡  | 优化信的格式与视觉：信纸质感、信封开合、邮票贴附等，让写信 / 读信更有仪式；**优先级低**，待核心体验稳定后再做 | — |
| 📌 备忘录     | ✅   | 长期维护文档，按 `key` 访问    | `memo` 表，`/memo`                      |
| 📄 内容模板    | 📋  | 模板管理：按类型（日记、时间线、信件、备忘录等）维护可复用模板；新建时选择模板快速填充标题与正文骨架；支持双方共建模板库 | — |


---



## 编辑与媒体


| 功能         | 状态  | 说明                     | 相关代码                                          |
| ---------- | --- | ---------------------- | --------------------------------------------- |
| TipTap 富文本 | ✅   | 标题、列表、引用、格式工具栏         | `web/src/components/TiptapEditor.tsx`         |
| 图片上传       | ✅   | 粘贴 / 拖拽 / 按钮，SHA256 去重 | `src/api/assets.ts`                           |
| HEIC 转换    | 💡  | iPhone 照片上传时转 JPEG（未实现） | —
| 双存储        | ✅   | 本地磁盘 / Cloudflare R2   | `src/server/routes/assets.ts`，`src/worker.ts` |


---



## 评论


| 功能      | 状态  | 说明                                          | 相关代码                                                                              |
| ------- | --- | ------------------------------------------- | --------------------------------------------------------------------------------- |
| 底部评论    | ✅   | 嵌套回复一层，按类型开放                                | `src/api/comments.ts`，`CommentSection.tsx`                                        |
| 选中文字边注  | ✅   | 混合锚定；桌面右侧可折叠边注轨（默认收起）+ 移动 FAB/Sheet；与底部评论分区 | `MarginaliaRail.tsx`，`InlineMarginaliaPopover.tsx`，`web/src/lib/inlineComment.ts` |
| 评论编辑 UI | ✅   | 底部评论、回复与边注轨均支持作者编辑正文                        | `CommentSection.tsx`，`MarginaliaRail.tsx`，`PUT /api/comments/:id`                 |


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


| 功能            | 状态  | 说明                             | 相关代码                                                                                        |
| ------------- | --- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| 邮箱密码登录        | ✅   | better-auth                    | `src/auth.ts`                                                                               |
| 情侣专属（≤2 账号）   | ✅   | 注册硬限                           | `src/auth.ts`                                                                               |
| 作者规范名         | ✅   | 小圆子 / 小麟子                      | `src/authors.ts`                                                                            |
| 软删除           | ✅   | `deletedAt` 标记                 | `src/db/schema.ts`                                                                          |
| 作者归属校验        | ✅   | 编辑按类型策略（memo 双方可改，其余仅作者）；删除仅作者 | `src/content-policies.ts`                                                                   |
| 双模式运行         | ✅   | Node 本地 + Cloudflare 生产        | `src/server/`，`src/worker.ts`                                                               |
| CI/CD 部署      | ✅   | push main 自动部署                 | `.github/workflows/deploy.yml`                                                              |
| 响应式 + 暗色主题    | ✅   | 移动端布局、主题切换                     | `web/src/components/Layout.tsx`                                                             |
| 文章目录 TOC      | ✅   | 桌面左侧可折叠 TOC 轨（默认收起）+ 移动 FAB/抽屉 | `TableOfContents.tsx`，`railPreferences.ts`；见 [MARGINALIA-LAYOUT.md](./MARGINALIA-LAYOUT.md) |


---



## 设计与体验


| 功能               | 状态  | 说明                                                                                                                                                         |
| ---------------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 固定设计风格           | ✅   | Design Tokens + 组件规范见根目录 [DESIGN.md](../DESIGN.md)                                                                                                         |
| Design Tokens 体系 | ✅   | `web/src/index.css` 与 `DESIGN.md` YAML 对齐；禁止组件内硬编码色值                                                                                                       |
| 设计规范文档           | ✅   | [DESIGN.md](../DESIGN.md)（规范源）+ [docs/DESIGN.md](./DESIGN.md)（索引）                                                                                          |
| 主题定制             | ✅   | 亮 / 暗 / 跟随系统（本设备 `localStorage`）；主题色 accent 四档预设（双方共用，`/settings`）                                                                                         |
| 动效打磨             | 🚧  | **长期迭代**。本轮（2026-06-26）：`--motion-ease-`* token、抽屉/遮罩配对动画、按钮/图标按压反馈、`prefers-reduced-motion` 滚动、主题切换 `data-theme-switching` 防闪烁。待续：新页面/控件接入时抽检、彩蛋级动效（见下方）。 |
| 按钮态统一            | 🚧  | **长期迭代**。本轮：`.orbit-btn-ghost` / `-sm`、primary/danger/icon/toolbar 的 focus·active·disabled 统一；评论/边注内联操作用 ghost。待续：全站逐页对照 DESIGN.md、表单触控区等。                 |
| 图标 SVG 体系        | 🚧  | **长期迭代**。本轮：`OrbitIcons.tsx` 补全（工具栏、Toast、轨道收起）；chrome 区 emoji 清零；`extractToc` 迁至 `lib/toc.ts`。待续：Milkdown 编辑器 chrome、新增图标统一入库。                            |
| 组件细节打磨（总览）       | 🚧  | 上述动效 / 按钮 / 图标三项的集合跟踪项；**不设完成态**，随功能扩展持续对照 [DESIGN.md](../DESIGN.md) Do's and Don'ts                                                                       |
| 彩蛋惊喜             | 💡  | 隐藏交互与小惊喜：纪念日 / 相识日触发的动效或文案、Logo / 侧栏等隐秘手势解锁小动画或留言、写作里程碑（如第 100 篇）的轻量庆祝；不打扰日常使用，**优先级低**，待 Phase A–C 与核心体验稳定后再做                                             |


---



## 空间与首页


| 功能       | 状态  | 说明                                                                        |
| -------- | --- | ------------------------------------------------------------------------- |
| 空间档案     | ✅   | `GET/PUT /api/space`（底层复用 `settings` 表）；`/space` 编辑页；侧栏常驻展示纪念日；MVP 不做昵称爱称 |
| 首页 / 仪表盘 | 💡  | 有个人特点的首页：纪念日、精选照片、近期动态等；布局与信息架构尚未定稿，待空间档案落地后再设计                           |
| 侧栏纪念日展示  | ✅   | 依赖空间档案 API；点击可进入 `/space` 编辑                                              |


空间身份（纪念日、slogan、封面图等）与偏好设置（主题色、账号）分开展示与编辑，见下方「设置页」。

---



## 可观测性与日志


| 功能         | 状态  | 说明                                                                                                                   |
| ---------- | --- | -------------------------------------------------------------------------------------------------------------------- |
| 路由错误边界     | ✅   | `RouteErrorBoundary` 包裹 `<Outlet />`；白屏改为错误页 + 重试 / 返回；开发环境展示 stack                                                  |
| 前端排障文档     | ✅   | [DEBUGGING.md](./DEBUGGING.md)：白屏清单、TipTap 陷阱、`[anchor]` 日志约定；已知 Bug 见 [BUGS.md](./BUGS.md)                          |
| 开发环境全局错误钩子 | ✅   | `main.tsx`：`window.error` / `unhandledrejection` → `console.error`                                                   |
| 前端结构化日志    | ✅   | `web/src/lib/logger.ts`：模块前缀（`anchor` / `api` / `route` / `global`）；DEV 默认 `debug`，`localStorage orbit:logLevel` 可切换 |
| 后端结构化日志    | ✅   | `src/lib/logger.ts` + `requestContext` 中间件：requestId、method、path、status、durationMs；`LOG_LEVEL` 环境变量                  |
| 审计日志（持久化）  | ✅   | `audit_log` 表 + `recordAudit`；`GET /api/audit` 分页查询；写入覆盖文章 / 评论 / 空间 / 设置变更                                          |
| 审计日志页面     | 📋  | 只读 UI 浏览操作记录（时间、作者、操作、目标）；消费 `GET /api/audit`；入口待定（如 `/settings` 子页或 `/audit`）；**非紧急**，API 已就绪                       |


---



## 元数据与治理


| 功能            | 状态  | 说明                                                               |
| ------------- | --- | ---------------------------------------------------------------- |
| 创建 / 修改时间（DB） | ✅   | `createdAt` / `updatedAt` 已写入                                    |
| 创建 / 修改时间（UI） | ✅   | 详情页展示记录日期、创建时间、最近修改时间（有编辑时）                                      |
| 创建人 / 修改人     | ✅   | 展示作者；有编辑且修改者与作者不同时展示修改人                                          |
| 双人联署作者        | 📋  | 每篇仅一个 `author`；memo 通过 `couple` 编辑权限共同维护                         |
| 编辑变更 / 版本历史   | 📋  | 无 revision 表、无 diff                                              |
| 设置页           | ✅   | `/settings`：主题色 accent、明暗模式、改密 / 改邮箱；API Token、LLM Key 归 Phase B |


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


| 功能         | 状态  | 说明                                                                                                  |
| ---------- | --- | --------------------------------------------------------------------------------------------------- |
| 集成 AI 聊天助手 | ✅   | 站内侧栏流式聊天、会话持久化（默认私密、可开关共享）、全局/文章上下文、Tool 检索；`AiChatPanel.tsx`，`/api/ai`；设计见 [AI.md](./AI.md) |
| 智能总结       | 💡  | 按日 / 周 / 月 / 年聚合内容，生成恋爱日记式回顾                                                                        |
| AI 辅助编辑    | 💡  | 编辑器内选中段落改写、续写、提炼标题；与边注能力可组合                                                                         |
| 模型与密钥配置    | ✅   | 设置页 AI 面板：Workers AI 默认 + BYOK（OpenAI / Anthropic / DeepSeek），API Key 加密存储；`Settings.tsx`，`ai-model.ts` |


---



## 扩展功能（Phase D–E）


| 功能              | 状态  | 说明                       |
| --------------- | --- | ------------------------ |
| 恋爱地图            | 💡  | 地点实体 + 地图可视化             |
| 共同爱好（书 / 音 / 影） | 💡  | 新内容类型或独立表                |
| 消息通知            | 📋  | 新内容 / 评论 / 回信推送          |
| 热力图             | 💡  | 按日写作活跃度                  |
| 电子相册            | 💡  | 从 `asset` 聚合独立浏览         |
| 记账              | 💡  | 独立模块                     |
| 立体书             | 💡  | 创意展示，优先级较低               |
| 彩蛋惊喜            | 💡  | 见「设计与体验」；隐藏交互与惊喜时刻，优先级最低 |
| 移动端 APP         | 💡  | PWA 优先，原生壳待定             |


---



## 下一步（Next Up）

按优先级排列，完成一项后将状态改为 ✅ 并更新 [CHANGELOG](../CHANGELOG.md)（通过 conventional commit + release 流程）。

1. [x] 文章详情展示创建时间、最近修改时间、作者（Phase A）
2. [x] 固定设计风格：Design Tokens + 组件规范 + `DESIGN.md`（Phase A）
3. [x] 空间档案：`GET/PUT /api/space` + `/space` 页 + 侧栏纪念日展示；昵称 MVP 跳过（Phase A）
4. [x] 设置页：主题色 accent + 账号安全；API Token 放 Phase B（Phase A）
5. [x] 路由错误边界 + 排障文档（Phase A）
6. [x] 持久化审计日志表 + 查询接口（Phase A）
7. [x] 前端 / 后端结构化日志（Phase A）
8. [x] 评论编辑 UI（Phase A）
9. [ ] 组件细节打磨：按钮 / 动效 / 图标（**进行中**，首批已落地，见「设计与体验」；长期迭代，不设完成态）
10. [ ] API Token + REST 规范化（Phase B）

**后续方向（未排期）**：内容模板管理（见「内容分类」，降低各类型内容创建门槛）；审计日志浏览页（见「可观测性与日志」）；首页 / 仪表盘（纪念日、照片、近期内容等，展示形式待定，依赖空间档案与 `asset` 数据）；信件仪式感呈现（信纸、信封、邮票等，见「内容分类」，优先级低）；彩蛋惊喜（隐藏交互、纪念日动效等，见「设计与体验」，优先级最低）。

---



## 文档维护


| 变更类型        | 更新文档                                          |
| ----------- | --------------------------------------------- |
| 功能上线 / 状态变化 | 本文件（ROADMAP.md）                               |
| AI 集成 / 接口变更 | [AI.md](./AI.md)                                 |
| 版本发布        | [CHANGELOG.md](../CHANGELOG.md)（**自动生成**，勿手改） |
| 架构 / 表结构变更  | [ARCHITECTURE.md](./ARCHITECTURE.md)          |
| 提交与发布规范     | [CONTRIBUTING.md](./CONTRIBUTING.md)          |


PR 合并功能变更时，请同步更新 ROADMAP 中对应行的状态。