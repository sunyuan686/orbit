# 飞书接入调试备忘

> 联调与排障经验，补充 [FEISHU.md](./FEISHU.md) 方案文档。本地开发见 `npm run tunnel` + `ORBIT_PUBLIC_URL`。

---

## 两条入站链路

| 飞书后台 | Orbit 端点 | 用途 |
| -------- | ---------- | ---- |
| 事件配置 | `POST /api/integrations/feishu/events` | 收消息、写库、指令 |
| 回调配置 | `POST /api/integrations/feishu/callbacks` | 卡片回传、链接预览 |

出站（测试连接、通知）走飞书 Open API，与上表无关。

---

## 常见现象与原因

### Challenge 没返回 / 401

- 配置了 Encrypt Key 时，URL 校验 body 为 `{"encrypt":"..."}`，须先解密再返回 `{"challenge":"..."}`；此步不走签名校验。
- Verification Token 须与飞书「加密策略」一致；curl 自测需带 `token` 字段。
- 验签仅用于校验通过后的业务事件/回调。

### 测试连接成功，发消息无反应、服务端无日志

- 入站未到达 Orbit，不是业务逻辑问题。
- 逐项查：隧道是否在跑、`ORBIT_PUBLIC_URL` 是否与隧道域名一致、事件地址是否填 **events**（不是 callbacks）、是否订阅 `im.message.receive_v1`、**应用版本是否已发布**。
- 测试连接只证明 App Secret 可用；未发布版本时事件订阅不生效。

### 发布前有消息，发布后一次性写入

- 飞书可能对失败投递重试；Orbit 按 `message_id` 去重，积压消息会逐条处理。测试时少发几条。

### 设置页「已关闭」但测试已成功

- 「已连接」= 凭证完整 + **启用飞书接入** 已保存。
- 仅测试成功未启用时显示「已验证（未启用）」；入站写库须勾选启用。

### 测试连接报 Bot/User can NOT be out of the chat

- 填了 Home Chat 但 Bot 未进群，或 chat_id 错误。
- 可清空 Home Chat 改用 open_id 单聊测；须先在飞书里给 Bot 发过消息。

### 图片在网站裂图

- 本地：`saveAsset` 须写入 `data/assets/`，静态服务只挂载该目录（曾误写 `data/` 根目录）。
- 线上：Worker 已用 R2，路径与网站上传一致，无此问题。

### 补记日期与列表/详情不一致

- 飞书补记按北京时间 0 点存 `entry_date`（unix 对应 UTC 前一日 16:00）。
- 展示须用北京时间日界（`formatDate`），勿用 UTC 分量，否则会差一天。

---

## 内网穿透（本地联调飞书 Webhook）

飞书只能访问公网 HTTPS，本地开发用 **Cloudflare Quick Tunnel**（`cloudflared`），无需公网 IP、无需登录 Cloudflare 账号。

### 原理

```
飞书 ──HTTPS──→ *.trycloudflare.com ──cloudflared──→ 127.0.0.1:5173 (Vite)
                                                      ├─ /api → :3001 (Node)
                                                      └─ /assets → :3001
```

- 隧道只转发 **5173**（Vite）；API 由 Vite proxy 转到 **3001**。
- `ORBIT_PUBLIC_URL` 只影响 Webhook 展示地址、飞书消息里的 Orbit 链接；**浏览器登录仍用 `http://localhost:5173`**。

### 使用步骤

**终端 1**

```bash
npm run dev
```

**终端 2**

```bash
npm run tunnel
# 等价于 cloudflared tunnel --url http://127.0.0.1:5173
```

启动后终端会出现 `https://xxxx.trycloudflare.com`，复制到 `.env`：

```bash
ORBIT_PUBLIC_URL=https://xxxx.trycloudflare.com
```

保存 `.env` 后 **重启 `npm run dev`**（server 才会读到新公网地址）。设置页里的 Webhook URL 会随之更新。

飞书后台填写：

- 事件：`{ORBIT_PUBLIC_URL}/api/integrations/feishu/events`
- 回调：`{ORBIT_PUBLIC_URL}/api/integrations/feishu/callbacks`

### 依赖

```bash
brew install cloudflared
```

未安装时 `npm run tunnel` 会提示。

可选环境变量：`ORBIT_TUNNEL_PORT`（默认 `5173`）。

### 隧道常见问题

| 现象 | 原因 | 处理 |
| ---- | ---- | ---- |
| `connection refused` | dev 未启动，或 Vite 只监听 IPv6 | 先 `npm run dev`；`vite.config.ts` 已设 `host: "127.0.0.1"` |
| `Blocked request... host not allowed` | 隧道 Host 不是 localhost | `allowedHosts: [".trycloudflare.com"]` |
| 502 / invalid JSON | API server 未起或 proxy 目标错 | 确认 3001 有 `[server] Orbit Server running` |
| 飞书保存 URL 失败，本地 curl 正常 | 飞书后台地址仍是旧隧道域名 | 每次重启 `npm run tunnel` 域名会变，须同步改 `.env`、重启 dev、改飞书后台 |
| 设置页 Webhook 还是旧域名 | 未重启 server | 改 `ORBIT_PUBLIC_URL` 后重启 `npm run dev` |

Quick Tunnel 域名 **每次重启都会变**；长期联调可换固定隧道（Cloudflare 账号 + named tunnel），MVP 阶段 quick tunnel 够用。

### 与生产的区别

| 项 | 本地 + tunnel | 生产 |
| -- | ------------- | ---- |
| 公网地址 | `*.trycloudflare.com`（临时） | 正式域名 |
| 配置 | `.env` 的 `ORBIT_PUBLIC_URL` | `BETTER_AUTH_URL` / Worker 环境变量 |
| 存储 | SQLite + `data/assets/` | D1 + R2 |

上线后删除或注释 `ORBIT_PUBLIC_URL`，飞书 Webhook 改指向生产域名。

---

## 本地开发清单

1. `brew install cloudflared`（首次）
2. `npm run dev`（终端 1）
3. `npm run tunnel`（终端 2）→ 复制 `https://*.trycloudflare.com`
4. 写入 `.env` 的 `ORBIT_PUBLIC_URL` → **重启 dev**
5. 飞书事件/回调地址改为 `{ORBIT_PUBLIC_URL}/api/integrations/feishu/{events|callbacks}`
6. 加密策略与 Orbit 设置页一致 → 保存 challenge → **发布应用版本**

自测 challenge：

```bash
curl -s -X POST "$ORBIT_PUBLIC_URL/api/integrations/feishu/events" \
  -H "Content-Type: application/json" \
  -d '{"type":"url_verification","challenge":"ping","token":"<Verification Token>"}'
# 期望：{"challenge":"ping"}
```

---

## 联调顺序建议

1. 事件/回调 URL 保存（200 + challenge）
2. 启用接入 + 保存凭证 + 测试连接
3. 单聊：普通文字、`/today`、`留言：` / `信：` / `补记 M/D：`
4. 发图 → 网站是否展示
5. 通知 Tab 开飞书 → 网站发内容 → 对方是否收到
6. 可选：链接预览（`url.preview.get`）；卡片回传需先发带按钮的交互卡片

---

## 生产上线注意

- `BETTER_AUTH_URL` / 飞书 Webhook 均用正式域名，不用隧道
- D1 迁移 `0009_feishu_dedup`、`0010_notifications`（仅 `CREATE TABLE`，不删数据）
- R2 binding + `im:resource` 权限
- 改权限或订阅后重新发布飞书应用版本

---

## 代码锚点

| 模块 | 路径 |
| ---- | ---- |
| 事件/回调路由 | `src/api/integrations.ts` |
| 验签、challenge | `src/services/feishu-webhook.ts` |
| 回调处理 | `src/services/feishu-callback.ts` |
| 入站写库 | `src/services/feishu-inbound.ts` |
| 本地图片存储 | `src/server/routes/integrations.ts` → `data/assets/` |
| 线上图片存储 | `src/worker.ts` → R2 |
| 设置 UI | `web/src/components/FeishuIntegrationPanel.tsx` |
| 隧道脚本 | `scripts/dev-tunnel.sh`（`npm run tunnel`） |
| 公网基址 | `src/lib/public-base-url.ts`（读 `ORBIT_PUBLIC_URL`） |
| Vite 穿透相关 | `web/vite.config.ts`（`host`、`allowedHosts`、proxy） |
