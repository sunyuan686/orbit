# Orbit 功能路线图

> 版本记录 [CHANGELOG.md](./CHANGELOG.md) · 架构 [ARCHITECTURE.md](docs/ARCHITECTURE.md)
>
> 最后更新：2026-07-14

## 状态说明


| 标记  | 含义                  |
| --- | ------------------- |
| ✅   | 已完成                 |
| 🚧  | 进行中（含 MVP 已落地、仍有缺口） |
| 📋  | 待做（优先级见说明）          |


---

## 阶段总览


| 阶段        | 名称     | 状态  | 剩余工作                       |
| --------- | ------ | --- | -------------------------- |
| Phase 1–4 | 核心平台   | ✅   | —                          |
| Phase A   | 体验补齐   | 🚧  | 组件细节打磨（持续进行）               |
| Phase B   | 外部集成   | 🚧  | GitHub 同步；MCP / 更多 IM 优先级低 |
| Phase C   | 协作增强   | 🚧  | 版本历史、双人联署、飞书卡片通知与定时推送、节日提醒 |
| Phase D   | AI 与扩展 | 🚧  | 智能总结、AI 辅助编辑、恋爱地图、共同爱好     |
| Phase E   | 可视化趣味  | 🚧  | 首页完善（封面等）、立体书、彩蛋；恋爱记忆主能力已落地 |


---

## 持续进行

- 组件细节打磨（动效 / 按钮 / 图标 / 字体 / 配色 ）— Phase A
- 性能：Smart Placement、鉴权减 D1 往返、列表可选分页 ✅；缓存机制待评估 — Phase A

---



## 内容


| 功能             | 状态  | 说明                   |
| -------------- | --- | -------------------- |
| 日记 / 时间线 / 留言板 | ✅   | `entry` 多类型，富文本 + 图片 |
| 信箱 / 信件        | ✅   | 主信 + 回信树，列表折叠往来      |
| 备忘录            | ✅   | 按 `key` 长期维护         |
| 随想 / 短动态        | 📋  | 双态编辑器与媒体九宫格，方案见 [thought-compose.md](docs/specs/thought-compose.md) |
| 内容模板           | 📋  | 按类型复用模板，新建快速填充       |
| 信件仪式感呈现        | 🚧  | 列表信封探出卡片已上；信纸/信封阅读态仍待 |
| 留言板仪式感呈现       | ✅   | 便签卡列表；日记/时间线/信箱/备忘录分形态列表 |


编辑：TipTap 富文本、图片上传（SHA256 去重）、本地 / R2 双存储 ✅。

图片增强 📋（远期）：解析原始信息（EXIF 拍摄时间 / 设备 / 方位等）、HEIC 转换与展示、Live Photo（静图 + 短视频）支持。

评论：底部嵌套回复、选中文字边注（桌面轨 + 移动 Sheet）、作者编辑 ✅。矩阵见 [ARCHITECTURE.md#评论能力矩阵](docs/ARCHITECTURE.md#评论能力矩阵)。

搜索：FTS5 + trigram、`/search` ✅；高级中文分词 📋（远期，当前 trigram 够用）。

---



## 平台


| 功能                  | 状态  | 说明                                                                               |
| ------------------- | --- | -------------------------------------------------------------------------------- |
| 空间开通与身份             | ✅   | 一人注册 → 邀请加入，≤2 账号，可配置爱称；详见 [space-onboarding.md](docs/specs/space-onboarding.md) |
| 邀请邮件                | 📋  | MVP 仅复制链接                                                                        |
| 空间档案                | ✅   | 纪念日、slogan 等，`/settings?tab=space`                                               |
| 首页                  | 🚧  | MVP + 记忆摘要已落地；封面图、统计卡待做                                                           |
| 设置页                 | ✅   | 账户 / 界面 / 空间 / 集成 / 通知 / AI / API Token                                          |
| 认证与权限               | ✅   | better-auth；软删除；按类型作者归属校验                                                        |
| 部署                  | ✅   | Node 本地 + Cloudflare 生产，push main 自动部署                                           |
| 响应式 + 暗色主题          | ✅   | 移动端布局、主题切换                                                                       |
| PWA                 | ✅   | 可安装 + 离线壳                                                                        |
| 文章目录 TOC            | ✅   | 见 [marginalia-layout.md](docs/specs/marginalia-layout.md)                        |
| 国际化                 | 📋  | 界面 i18n，策略待定                                                                     |
| Design Tokens / 主题色 | ✅   | 见 [DESIGN.md](DESIGN.md)                                                         |
| 主题 / 字体切换        | 📋  | 设置页统一配置明暗、强调色与字体方案（正文 / 标题），偏好持久化                         |
| 彩蛋惊喜                | 📋  | 记忆星座彩蛋已落地；其余隐藏交互优先级低                                                          |
| 创建 / 修改时间与作者        | ✅   | 详情页展示                                                                            |
| 双人联署                | 📋  | 每篇多人署名                                                                           |
| 版本历史                | 📋  | revision 表与 diff                                                                 |
| 审计日志 API            | ✅   | 持久化 + `GET /api/audit`                                                           |
| 审计日志浏览页             | 📋  | 只读 UI，API 已就绪                                                                    |
| 数据导入 / 导出           | 📋  | 空间内容批量导出与迁移导入，优先级低                                                               |
| 配置导入 / 导出           | 📋  | 设置、集成等配置备份与恢复，优先级低                                                               |


---



## 外部集成（Phase B）


| 功能          | 状态  | 说明                                                  |
| ----------- | --- | --------------------------------------------------- |
| API Token   | ✅   | Bearer 鉴权，见 [api-token.md](docs/specs/api-token.md) |
| GitHub 双向同步 | 📋  | 写入 commit `.md`，Webhook 反向同步                        |
| MCP 端点      | 📋  | 优先级低；Claude / Cursor 直接操作                           |




### IM 连接

飞书已覆盖主要随手记录与通知场景；其他 IM 按需扩展，优先级均低。


| 功能       | 状态  | 说明                                                                    |
| -------- | --- | --------------------------------------------------------------------- |
| 飞书 Bot   | ✅   | 入站写日记/图片、指令查询、出站通知；见 [feishu.md](docs/specs/feishu.md)                |
| 飞书第二期    | ✅   | `留言：` / `信：` 前缀、`/` 指令写入、AI `/summary` 月报等；见 [feishu.md](docs/specs/feishu.md) |
| 飞书陪伴与对话 | 🚧  | 飞书内 AI 多轮聊天（CardKit 流式打字机 + Thread 会话）已落地；主动陪伴 MVP 已接入 DO Alarm、飞书卡片与设置页；见 [feishu-companion.md](docs/specs/feishu-companion.md)、[proactive-companion.md](docs/specs/proactive-companion.md) |
| Telegram | 📋  | 优先级低；与飞书同类连接器                                                         |
| 更多平台     | 📋  | 微信、Discord 等                                                          |


双人空间共享一套 IM 配置；Webhook 校验签名。

---



## 消息通知（Phase C）


| 功能        | 状态  | 说明                                    |
| --------- | --- | ------------------------------------- |
| 站内通知      | ✅   | 顶栏铃铛、未读角标、跳转详情                        |
| 飞书出站通知    | ✅   | 关键事件推送（纯文本），复用飞书凭证                    |
| 飞书通知卡片    | 🚧  | 恋爱记忆里程碑已用 interactive card；通用出站事件仍待改卡片；统一方案见 [feishu-companion.md](docs/specs/feishu-companion.md) |
| 通知偏好      | ✅   | 按事件类型开关，`/settings?tab=notifications` |
| 主动触达飞书卡片  | 🚧  | DO Alarm 动态调度陪伴/回顾类卡片，支持设置页配置触达窗口与安静时段；见 [proactive-companion.md](docs/specs/proactive-companion.md) |
| 飞书 AI 对话   | 🚧  | Bot 内多轮流式聊天，基于 CardKit 卡片与空间记录；见 [feishu-companion.md](docs/specs/feishu-companion.md) |
| AI 摘要就绪通知 | 📋  | 智能总结完成后触达；可复用飞书卡片通道                   |
| 节日提醒      | 📋  | 生日、纪念日、周年纪念、自定义特殊日；临近提醒，可并入定时卡片推送   |


---



## AI（Phase D）


| 功能      | 状态  | 说明                                                        |
| ------- | --- | --------------------------------------------------------- |
| 聊天助手    | ✅   | 侧栏流式聊天、会话持久化、全局/文章上下文、Tool 检索与 `write_content` 写入审批；**无步数上限**（跑到模型收尾为止）；见 [ai.md](docs/specs/ai.md) |
| 模型与密钥配置 | ✅   | Workers AI / DeepSeek / 自定义 OpenAI 兼容                     |
| 智能总结    | 📋  | 日/周/月/年恋爱日记式回顾                                            |
| AI 辅助编辑 | 📋  | 改写、续写、提炼标题                                                |


---



## 扩展（Phase D–E）


| 功能      | 状态  | 说明                                                  |
| ------- | --- | --------------------------------------------------- |
| 写作热力图   | ✅   | `/activity`，见 [activity.md](docs/specs/activity.md) |
| 电子相册    | ✅   | `/gallery`，见 [gallery.md](docs/specs/gallery.md)    |
| 恋爱记忆星图  | ✅   | `/memories` 按日星图；见 [love-memories.md](docs/specs/love-memories.md) |
| 恋爱记忆图鉴  | ✅   | `/memories/atlas`；主题分册 + 星座；地图/爱好待模块接入             |
| 记忆里程碑   | ✅   | `milestone_unlock` + 庆祝动效 + 飞书卡片；含星座彩蛋               |
| 恋爱地图    | 📋  | 地点实体 + 地图可视化；星图节点可挂坐标                                   |
| 共同爱好    | 📋  | 书 / 音 / 影；可作为图鉴维度扩展                                      |
| 记账      | 📋  | 独立模块，优先级较低                                          |
| 立体书     | 📋  | 创意展示，优先级较低                                          |
| 移动端 APP | 🚧  | PWA 已落地，原生壳待定                                       |


PR 合并功能变更时，同步更新本文件中对应状态。
