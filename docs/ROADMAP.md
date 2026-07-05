# Orbit 功能路线图

> **单一进度源**：功能状态以此文档为准。
>
> 版本发布记录见 [CHANGELOG.md](../CHANGELOG.md)，
>
> 架构说明见 [ARCHITECTURE.md](./ARCHITECTURE.md)。
>
> 最后更新：2026-07-05 · 当前版本：[v0.0.1](../CHANGELOG.md#001---2026-06-24)（main 已含飞书集成、消息通知、相册、API Token、空间开通泛化等未发版功能）

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
| Phase A   | 体验补齐   | 🚧  | 审计日志、结构化日志、评论编辑 UI、**账号开通泛化**（可配置爱称 + 邀请加入）已落地；组件细节打磨（按钮/动效/图标）**进行中**；PWA 待做 |
| Phase B   | 外部集成   | ⚠️  | **飞书 Bot MVP 已落地**；**API Token MVP 已落地**；GitHub 同步、MCP 待做；Telegram 优先级最低 |
| Phase C   | 协作增强   | ⚠️  | **消息通知 MVP 已落地**（站内铃铛 + 飞书出站、偏好设置）；版本历史、双人联署待做 |
| Phase D   | AI 与扩展 | 🚧  | AI 聊天助手与模型配置 MVP 已落地；智能总结、恋爱地图、共同爱好等待做               |
| Phase E   | 可视化趣味  | ⚠️  | **电子相册 MVP 已落地**；热力图、记账、立体书、彩蛋惊喜待做 |


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



## 账号注册与邀请

Orbit 是**双人情侣空间**，账号开通遵循「一人注册 → 邀请另一方」，**不是**两人都各自打开注册页独立注册。

| 步骤 | 角色 | 说明 |
| --- | --- | --- |
| 1 | 发起人 | 首个注册账号（邮箱 + 密码），开通空间 |
| 2 | 发起人 | 设定空间内双方的**署名身份**（如昵称 / 爱称，由这对情侣自定义，见下） |
| 3 | 发起人 | 生成邀请链接并发送给另一方（复制链接；邮件待做） |
| 4 | 受邀方 | 打开 `/join?token=` 完成注册加入，之后仅登录即可 |

**署名身份**（产品目标）：

- 每对情侣在**自己的空间**里定义两个互斥的展示名，用于内容署名、评论、AI 对话区分等
- 不是全站统一的固定名字；其他情侣可以是「小明 / 小红」「阿树 / 小鹿」等
- 权限对等：署名仅标识「谁写的」，不做主从账号

约定与约束：

- 全站最多 **2 个账号**；第二位只能通过邀请加入，注册入口在满员后关闭
- 两人各占一个署名位，不可重复
- 权限对等：`author` 仅署名，不做主从账号区分

> **当前实现**：第一人邮箱注册时自填爱称（`user.name`）；满 1 人关闭公开注册；设置页生成邀请链接；受邀方走 `/join?token=`；内容权限认 `user_id`，展示 resolve 爱称；存量数据 migration `0011` 按 `author` 回填 `user_id`。详见 [SPACE-ONBOARDING.md](./SPACE-ONBOARDING.md)。

### 已实现（2026-07）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 可配置双方署名 | ✅ | 注册 / 邀请时自填爱称 → `user.name`；内容以 `user_id` 标识；读出 JOIN 爱称 |
| 第一人注册流程 | ✅ | 去掉小圆子/小麟子二选一；邮箱 + 密码 + 自填爱称 |
| 爱称编辑 | ✅ | `/settings?tab=account` 改 `user.name`；旧文展示随爱称更新 |
| 邀请加入 | ✅ | 邀请链接复制；`/join?token=`；满 1 人关闭公开注册 |
| 存量兼容 | ✅ | migration `0011` 按 `author` 回填 `user_id`；`author` 列双写保留 |

**主要代码**：`src/api/invite.ts`，`src/services/space-authors.ts`，`web/src/pages/Login.tsx`，`web/src/pages/Join.tsx`，migration `0011_space_onboarding.sql`

### 待做（后续）

| 项 | 状态 | 说明 |
| --- | --- | --- |
| 邀请邮件发送 | 💡 | MVP 仅复制链接；邮件投递未做 |

---

## 平台能力


| 功能            | 状态  | 说明                             | 相关代码                                                                                        |
| ------------- | --- | ------------------------------ | ------------------------------------------------------------------------------------------- |
| 邮箱密码登录        | ✅   | better-auth                    | `src/auth.ts`                                                                               |
| 发起人首开空间       | ✅   | 第一人邮箱注册，满员前可注册              | `src/auth.ts`                                                                               |
| 邀请加入（非双人各自注册） | ✅  | 邀请链接复制；`/join?token=`；满 1 人关闭公开注册 | `src/api/invite.ts`，`web/src/pages/Join.tsx` |
| 可配置双方署名        | ✅  | 空间级自定义两人展示名；注册 / 邀请自填爱称；设置页可改 | `src/services/space-authors.ts`，`src/api/account.ts`，`web/src/pages/Login.tsx` |
| 情侣专属（≤2 账号）   | ✅   | 注册硬限；见上文「账号注册与邀请」              | `src/auth.ts`                                                                               |
| 作者规范名（遗留别名）    | ⚠️  | `src/authors.ts` 保留存量 author 字符串回填别名；权限与 UI 已认 `userId` | `src/authors.ts`                                                                            |
| 软删除           | ✅   | `deletedAt` 标记                 | `src/db/schema.ts`                                                                          |
| 作者归属校验        | ✅   | 编辑按类型策略（memo 双方可改，其余仅作者）；删除仅作者 | `src/content-policies.ts`                                                                   |
| 双模式运行         | ✅   | Node 本地 + Cloudflare 生产        | `src/server/`，`src/worker.ts`                                                               |
| CI/CD 部署      | ✅   | push main 自动部署                 | `.github/workflows/deploy.yml`                                                              |
| 响应式 + 暗色主题    | ✅   | 移动端布局、主题切换                     | `web/src/components/Layout.tsx`                                                             |
| 文章目录 TOC      | ✅   | 桌面左侧可折叠 TOC 轨（默认收起）+ 移动 FAB/抽屉 | `TableOfContents.tsx`，`railPreferences.ts`；见 [MARGINALIA-LAYOUT.md](./MARGINALIA-LAYOUT.md) |
| 国际化 / 多语言     | 📋  | 界面文案 i18n（如中 / 英切换）、日期与数字本地化；富文本与搜索对多语言内容的策略待定 | — |


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
| 空间档案     | ✅   | `GET/PUT /api/space`（底层复用 `settings` 表）；`/settings?tab=space` 编辑（`SpaceSettingsPanel.tsx`）；侧栏常驻展示纪念日；双方爱称见 `/settings?tab=account` |
| 首页 / 仪表盘 | ⚠️  | MVP 已落地（`/`）：Hero、探索卡、最近动态与照片；封面图、统计卡等待做 |
| 侧栏纪念日展示  | ✅   | 依赖空间档案 API；点击可进入 `/settings?tab=space` 编辑                                 |


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
| 设置页           | ✅   | `/settings?tab=`：分组侧栏（账户 / 界面 / 空间 / 集成 / 通知 / AI / API Token）；移动端 Notion 式 drill-down；主题色、账号安全、空间档案、飞书集成、通知偏好、AI 模型与 Key、API Token 管理 |


---



## 外部集成（Phase B）


| 功能          | 状态  | 说明                              |
| ----------- | --- | ------------------------------- |
| API Token   | ✅  | Bearer Token；`GET/POST/DELETE /api/api-tokens`；设置页 `?tab=api-tokens`；内容 API 支持 `Authorization: Bearer orb_…` |
| GitHub 双向同步 | 📋  | 写入自动 commit `.md`，Webhook 反向同步  |
| MCP 端点      | 📋  | `/api/mcp`，Claude / Cursor 直接操作 |
| IM 连接       | ⚠️  | **飞书 MVP 已落地**；Telegram 优先级最低；详见下节 |


---

## IM 连接（Phase B）

在常用 IM 里随手记录、查内容，无需打开网站。各平台在 **`/settings?tab=integrations`** 集中配置，连接状态、启用 / 停用、凭证与身份映射均可视化管理。

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 设置页 IM 管理面板 | ✅ | `FeishuIntegrationPanel`：飞书连接配置、测试连通性；App Secret 等敏感项加密存储（对齐 AI Key 方案） |
| Telegram 接入 | 💡 | 绑定 Bot；私信 / 指定会话 → 写日记；**优先级最低**，待 MCP / GitHub 同步等 Phase B 核心项完成后再做 |
| 飞书接入 | ✅ | 企业自建应用 Bot；Webhook 入站（`POST /api/integrations/feishu/events`）；文字 → 今日 diary、图片 → R2 + `asset`；指令 `/today`、`/week`、`/month`、`/搜`；详见 [FEISHU.md](./FEISHU.md) |
| IM 用户 → 署名映射 | ✅ | 飞书 `authorOpenIds` 按 `userId` 映射；设置页动态展示空间作者 open_id |
| 入站：文字 / 图片 / 相册 | ✅ | 飞书：文字落当天 diary、图片附当天记录；短窗口合并（`mergeWindowMs`） |
| 出站通知（飞书等） | ✅ | 与 Phase C 联动：`notify.ts` 调飞书发消息 API；Home Chat / open_id 私聊可配 |

**产品约定**：

- 双人空间共享一套 IM 连接配置（与主题色、空间档案同级），不按账号各配一套 Bot
- 仅登录用户可在设置中修改连接；Webhook 入口需校验签名 / Token
- 新平台（如微信、Discord 等）按同一「连接器」抽象扩展，ROADMAP 先列 Telegram / 飞书

**预期改动面**（实现时对照）：

- `web/src/pages/Settings.tsx` — 新增 IM / 集成分组与配置 UI
- `src/api/integrations.ts`（或同类）— 连接 CRUD、凭证加解密、连通性探测
- `src/db/schema.ts` — `im_connection` 或 `settings` 结构化存储（platform、encryptedSecret、status、authorMapping）
- `src/worker.ts` / 路由 — Telegram webhook、`/api/integrations/feishu` 等入站端点
- `docs/ARCHITECTURE.md` — 入站消息 → `entry` / `asset` 流水线说明

**优先级**：Phase B 剩余项为 MCP、GitHub 同步；Telegram 放最后。飞书第二期扩展（`留言：` / `信：` 前缀、`/summary` AI 月报等）见 [FEISHU.md](./FEISHU.md)。

---

## 消息通知（Phase C）

对方有新动态时及时触达，减少「要手动刷站才知道」的摩擦。分 **站内** 与 **飞书** 两条通道，可独立开关；飞书出站依赖 Phase B「飞书接入」。

| 功能 | 状态 | 说明 |
| --- | --- | --- |
| 站内消息通知 | ✅ | 顶栏 `NotificationBell` + 未读角标；列表展示新内容 / 评论 / 边注 / 回信；单条或全部标记已读；点击跳转详情 |
| 飞书消息通知 | ✅ | 关键事件推送飞书（文本摘要 + 链接）；Home Chat 或 open_id 私聊；复用飞书集成凭证 |
| 通知触达事件 | ✅ | 新日记 / 时间线 / 留言、新评论 / 边注、新回信；`articles.ts` / `comments.ts` 触发 `notify.ts` |
| 通知偏好设置 | ✅ | `/settings?tab=notifications`：按事件类型分别开关站内 / 飞书；评论合并节流可配 |

**产品约定**：

- 仅通知**对方**（双人空间中除事件发起者外的另一署名位），不给自己发重复提醒
- 站内通知为默认通道；飞书为可选增强，未连接飞书时仅走站内
- 同一事件可合并节流（如 5 分钟内同篇多条评论合并为一条摘要），避免刷屏
- 审计日志记录通知下发结果（成功 / 失败 / 跳过），便于排障

**预期改动面**（实现时对照）：

- `src/db/schema.ts` — `notification` 表（recipient、type、targetId、readAt、payload）
- `src/api/notifications.ts` — 列表、未读数、标记已读
- `src/services/notify.ts` — 事件订阅（entry / comment / letter 创建）→ 写站内通知 + 可选调飞书出站
- `web/src/components/NotificationBell.tsx`（或同类）— 顶栏入口与下拉列表
- `web/src/pages/Settings.tsx` — 通知偏好 UI
- `src/worker.ts` / 飞书连接器 — 出站消息 API（复用 Phase B 凭证）

**优先级**：Phase C 剩余项（版本历史、双人联署）；通知后续可扩展 AI 摘要就绪、纪念日提醒等事件。

---



## AI 能力（Phase D）


| 功能         | 状态  | 说明                                                                                                  |
| ---------- | --- | --------------------------------------------------------------------------------------------------- |
| 集成 AI 聊天助手 | ✅   | 站内侧栏流式聊天、会话持久化（默认私密、可开关共享）、会话列表末条预览、嵌入 reasoning 折叠展示、全局/文章上下文、Tool 检索、会话内模型切换（`AiModelPicker`）；移动 FAB（`AiChatFab`）；`AiChatPanel.tsx`，`/api/ai`；设计见 [AI.md](./AI.md) |
| 智能总结       | 💡  | 按日 / 周 / 月 / 年聚合内容，生成恋爱日记式回顾                                                                        |
| AI 辅助编辑    | 💡  | 编辑器内选中段落改写、续写、提炼标题；与边注能力可组合                                                                         |
| 模型与密钥配置    | ✅   | `AiProvidersSettingsPanel`：Workers AI / DeepSeek 内置供应商开关与模型目录（`workers-models`、`deepseek-models`）；BYOK DeepSeek Key；自定义 OpenAI 兼容连接（baseUrl + 模型列表 + 加密 Key）；启用模型白名单；`ai-connections.ts`，`app-settings.ts`，`/api/settings` |


---



## 扩展功能（Phase D–E）


| 功能              | 状态  | 说明                       |
| --------------- | --- | ------------------------ |
| 恋爱地图            | 💡  | 地点实体 + 地图可视化             |
| 共同爱好（书 / 音 / 影） | 💡  | 新内容类型或独立表                |
| 消息通知（总览）        | ✅  | 站内 + 飞书双通道 MVP 已落地；详见「消息通知（Phase C）」 |
| 热力图             | 💡  | 按日写作活跃度                  |
| 电子相册            | ✅  | `/gallery`：R2/本地全集浏览、关联筛选、lightbox、孤儿图安全删除；见 [GALLERY.md](./GALLERY.md) |
| 记账              | 💡  | 独立模块                     |
| 立体书             | 💡  | 创意展示，优先级较低               |
| 彩蛋惊喜            | 💡  | 见「设计与体验」；隐藏交互与惊喜时刻，优先级最低 |
| 移动端 APP         | 💡  | PWA 优先，原生壳待定             |


---



## 下一步（Next Up）

按优先级排列，完成一项后将状态改为 ✅ 并更新 [CHANGELOG](../CHANGELOG.md)（通过 conventional commit + release 流程）。

1. [x] 文章详情展示创建时间、最近修改时间、作者（Phase A）
2. [x] 固定设计风格：Design Tokens + 组件规范 + `DESIGN.md`（Phase A）
3. [x] 空间档案：`GET/PUT /api/space` + `/settings?tab=space` + 侧栏纪念日展示；昵称 MVP 跳过（Phase A）
4. [x] 设置页：分组导航 + 移动端 drill-down + 主题色 / 账号 / 空间 / AI；API Token 放 Phase B（Phase A）
5. [x] 路由错误边界 + 排障文档（Phase A）
6. [x] 持久化审计日志表 + 查询接口（Phase A）
7. [x] 前端 / 后端结构化日志（Phase A）
8. [x] 评论编辑 UI（Phase A）
9. [ ] 组件细节打磨：按钮 / 动效 / 图标（**进行中**，首批已落地，见「设计与体验」；长期迭代，不设完成态）
10. [x] 可配置双方署名 + 注册认领身份位（Phase A，见「账号注册与邀请」）
11. [x] 邀请加入（一人注册 → 邀请另一方，关闭公开二次注册；Phase A，同上）
12. [x] API Token + REST 规范化（Phase B）
13. [x] IM 连接：飞书 Bot MVP（`?tab=integrations`、入站写日记/图片、指令查询；Phase B，见「IM 连接」）
14. [x] 站内消息通知（Phase C，见「消息通知」）
15. [x] 飞书消息通知（Phase C，见「消息通知」）
16. [x] 电子相册 MVP（Phase E，`/gallery`；见 [GALLERY.md](./GALLERY.md)）
17. [ ] MCP 端点（Phase B）
18. [ ] GitHub 双向同步（Phase B）
19. [ ] Telegram 接入（Phase B，**优先级最低**，见「IM 连接」）

**后续方向（未排期）**：国际化 / 多语言（见「平台能力」，界面与本地化）；内容模板管理（见「内容分类」，降低各类型内容创建门槛）；审计日志浏览页（见「可观测性与日志」）；首页 / 仪表盘（纪念日、照片、近期内容等，展示形式待定，依赖空间档案与 `asset` 数据）；信件仪式感呈现（信纸、信封、邮票等，见「内容分类」，优先级低）；飞书第二期（`留言：` / `信：` 前缀、AI `/summary` 月报，见 [FEISHU.md](./FEISHU.md)）；更多 IM 平台连接器（微信、Discord 等，见「IM 连接」）；彩蛋惊喜（隐藏交互、纪念日动效等，见「设计与体验」，优先级最低）。

---



## 文档维护


| 变更类型        | 更新文档                                          |
| ----------- | --------------------------------------------- |
| 功能上线 / 状态变化 | 本文件（ROADMAP.md）                               |
| 空间开通 / 署名 / 邀请 | [SPACE-ONBOARDING.md](./SPACE-ONBOARDING.md)       |
| AI 集成 / 接口变更 | [AI.md](./AI.md)                                 |
| 版本发布        | [CHANGELOG.md](../CHANGELOG.md)（**自动生成**，勿手改） |
| 架构 / 表结构变更  | [ARCHITECTURE.md](./ARCHITECTURE.md)          |
| 首页设计与行为     | [HOME.md](./HOME.md)                          |
| 提交与发布规范     | [CONTRIBUTING.md](./CONTRIBUTING.md)          |


PR 合并功能变更时，请同步更新 ROADMAP 中对应行的状态。