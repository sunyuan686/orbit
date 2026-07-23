# 飞书接入方案

> 飞书 Bot 作为 Orbit 的**移动端输入端 + 查询入口 + 通知通道**。
>
> 内容仍落在 Orbit 的 `entry` / `asset` / 评论体系，不替代网站编辑体验。  
> 进度总览见 [ROADMAP.md](../../ROADMAP.md)（Phase B IM 连接、Phase C 消息通知）。

---

## 架构

```
飞书用户 ──入站 Webhook──→ Orbit Worker ──→ D1 / R2
                ↑                              │
                └──── 出站发消息 API ──────────┘（通知）
```

- **生产**：Webhook 模式（Cloudflare Workers 无长驻进程，不用 WebSocket）
- **开发**：Webhook + tunnel，或本地 WebSocket（仅调试）
- **机器人类型**：企业自建应用 Bot（非群自定义 Webhook，后者只能单向推送）

---

## 能力一览

### 能写（入站，Phase B）


| 操作     | 落库                                |
| ------ | --------------------------------- |
| 发文字    | 今日 `diary`（`user_id` 由 open_id → `user.id` 映射） |
| 发图片/相册 | R2 → `asset`，附当天 diary            |
| 连续多条   | 短窗口内合并或追加同一条                      |


**规则**：单聊全收；群聊须 @Bot；仅白名单 open_id（映射到空间内 `user.id`）。

**扩展（第二期）**：`留言：` / `信：` 指定类型；`补记 6/28：` 指定日期；解析 `post` 富文本。

### 能查（入站指令，Phase B）


| 指令                 | 作用                        |
| ------------------ | ------------------------- |
| `/today`           | 今日 diary 摘要               |
| `/week`、`/month 6` | 按时间聚合列表                   |
| `/搜 关键词`           | FTS 搜索，附网站链接              |
| `/summary 6月`      | AI 月度总结（第三期，复用 `/api/ai`） |


以 `/` 或 `搜`/`查` 开头走查询，**不写入**；普通文字默认写入。

### 能通知（出站，Phase C）


| 事件            | 接收人 |
| ------------- | --- |
| 新 diary / 时间线 | 对方  |
| 新评论 / 边注      | 对方  |
| 新回信           | 对方  |


- 站内通知为默认；飞书为可选，复用 Phase B 凭证
- 不通知事件发起者本人
- 同篇短时间去重合并；遵守飞书 5 QPS

投递目标：Home Chat（指定群/单聊）或按 open_id 私聊，设置页可配。

---



## 飞书侧配置

1. [开发者后台](https://open.feishu.cn/app) 创建企业自建应用，开启「机器人」
2. 权限（最小集）：`im:message`、`im:message:send_as_bot`、`im:resource`；群聊加 `im:message.group_at_msg:readonly`
3. 事件订阅：`im.message.receive_v1`，方式选 **Webhook** → `POST /api/integrations/feishu/events`
4. 加密策略：配置 Encrypt Key + Verification Token（验签 + 解密）
5. 发布应用版本（需管理员审核）

---



## 实现要点


| 项      | 说明                                                                   |
| ------ | -------------------------------------------------------------------- |
| 验签     | `SHA256(timestamp + nonce + encryptKey + body)` ↔ `X-Lark-Signature` |
| URL 验证 | 1 秒内原样返回 `challenge`                                                 |
| 去重     | `message_id` 持久化 24h（D1/KV），防飞书重推                                    |
| 超时     | Webhook 3 秒内 ack；写库/下载图片用 `waitUntil` 异步                             |
| 自回声    | 过滤 Bot 自身 `open_id`，防循环                                              |
| 凭证     | App Secret / Encrypt Key 加密存储（对齐 AI Key 方案）                          |


**预期改动**：`src/api/integrations.ts`、`src/worker.ts` 入站端点、`src/services/notify.ts` 出站、`web/src/pages/Settings.tsx` + `FeishuIntegrationPanel.tsx`（连接配置 UI）、`src/db/schema.ts`。

---



## 分期


| 阶段      | 内容                                                                   |
| ------- | -------------------------------------------------------------------- |
| **B-1** | Webhook + 写（文字/图）+ `/today` + **设置页** `integrations`**（凭证、映射、测试连接）** |
| **B-2** | `/month`、FTS 搜索、补记/类型前缀、群 @ 门控                                       |
| **C-1** | 站内通知（铃铛），可与 B 并行                                                     |
| **C-2** | 飞书出站通知 + 偏好 + 节流                                                     |
| **可选**  | `/summary` 等单次指令已部分落地；主动陪伴推送与飞书 AI 多轮对话见 [feishu-companion.md](./feishu-companion.md) |
| **已落地** | 恋爱记忆里程碑解锁 → interactive card（见 [love-memories.md](./love-memories.md)） |


---



## 设置页配置

连接相关配置**全部在设置页完成**，不依赖改环境变量或改代码。交互对齐现有 **Orbit AI** 面板（`AiProvidersSettingsPanel`）：分组表单、敏感项脱敏、保存后加密入库、一键测试连通性。

### 入口与权限


| 项   | 说明                                                                           |
| --- | ---------------------------------------------------------------------------- |
| 路由  | `/settings?tab=integrations`（连接）；`/settings?tab=notifications`（通知偏好，Phase C） |
| 侧栏  | 新增分组 **「连接 / 集成」**，与账户 / 界面 / 空间 / 功能并列                                      |
| 权限  | 仅**已登录**用户可查看与保存；Webhook 端点本身不走登录，靠验签                                        |
| 范围  | 双人空间**共用一套**飞书连接，不按账号各配 Bot                                                  |




### `integrations` Tab — 飞书连接（Phase B）


| 字段                 | 必填  | 说明                                                        |
| ------------------ | --- | --------------------------------------------------------- |
| 启用                 | —   | 总开关；关闭后忽略入站 Webhook（仍应验签后丢弃）                              |
| App ID             | ✅   | 飞书自建应用凭证                                                  |
| App Secret         | ✅   | 加密存储；UI 仅显示「已配置 / 未配置」，支持覆盖更新                             |
| Encrypt Key        | 推荐  | 事件验签与解密                                                   |
| Verification Token | 可选  | payload 内 token 校验（纵深防御）                                  |
| Webhook URL        | 只读  | 展示 `https://<域名>/api/integrations/feishu/events`，供复制到飞书后台 |
| 连接状态               | 只读  | 已连接 / 未配置 / 上次错误                                          |
| **测试连接**           | 按钮  | 校验凭证并尝试发一条测试消息到 Home Chat 或当前操作者映射的单聊                     |


**身份映射**（同 Tab 内子区块；key 为 `user.id`，展示标签为当前爱称）：


| 字段 | 说明 |
| --- | --- |
| `{userId}` → open_id | 飞书用户 open_id |

实现见 [space-onboarding.md](./space-onboarding.md)。


**写入行为**（可折叠「高级」）：


| 字段          | 默认      | 说明                 |
| ----------- | ------- | ------------------ |
| 默认写入类型      | `diary` | 入站文字落库类型           |
| 允许群 chat_id | 空       | 空=仅单聊；填则该群 @Bot 可写 |
| 消息合并窗口      | 2s      | 连续消息合并追加           |




### `notifications` Tab — 通知偏好（Phase C）

与连接 Tab 分离：凭证只在 `integrations` 维护；此处只控制**是否推送、推什么**。


| 字段        | 说明                            |
| --------- | ----------------------------- |
| Home Chat | 通知默认投递群/单聊 `chat_id`          |
| 分事件开关     | 新 diary / 评论边注 / 回信 × 站内 / 飞书 |
| 合并节流      | 同篇 N 分钟内评论合并（默认 5 分钟）         |




### 后端与存储

- 配置经 `GET/PUT /api/integrations/feishu`（或并入 `/api/settings` 结构化字段）读写
- 敏感项用 `encryptSettingSecret`（与 AI Key 相同方案）写入 `settings` 或 `im_connection` 表
- 设置页保存后即时生效，无需重新部署 Worker

---



## 边界

**适合飞书**：短记、拍照、查摘要、收对方动态。  
**仍用网站**：长文编辑、边注排版、复杂互动。  
**不做 MVP**：云文档同步、WebSocket 长连接、流式卡片、OAuth 用户身份操作飞书全套 API。

---



## 参考

- [恋爱记忆](./love-memories.md) — 里程碑飞书卡片出站
- [飞书接入调试备忘](./feishu-dev.md) — 联调排障、本地隧道、常见 401/无日志/图片/日期问题
- [飞书机器人概述](https://open.feishu.cn/document/uAjLw4CM/ukTMukTMukTM/bot-v3/bot-overview)
- [事件订阅 / 验签](https://open.feishu.cn/document/server-docs/event-subscription-guide/event-subscription-configure-/encrypt-key-encryption-configuration-case)
- 开源实现：`larksuite/openclaw-lark`、`NousResearch/hermes-agent`（dedup、post 解析、@ 门控、Webhook 安全可借鉴）

