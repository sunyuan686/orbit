# 头像与爱称切换仅有弹窗但未视觉更新（Better Auth CookieCache 割裂）

> 创建：2026-10-10
> 状态：已修复

## 现象

用户在「设置 → 个人资料」中点击选择手账插画头像或修改爱称时：
1. 界面弹出了成功的 Toast 提示（如「已换上「星夜」手账头像」）。
2. 但左侧主头像预览、插画选中高亮框、侧边栏及抽屉头像均未发生改变，维持原样不变。

## 期望行为

- 点击预置头像或上传自定义头像后，头像预览即时切换为最新头像，对应预设卡片呈现激活高亮状态。
- 全局使用 `authClient.useSession()` 的组件（`UserAccount`、`UsMenuSheet`、`UserAboutSheet`）跨组件与跨标签页实时响应更新。
- 架构上杜绝双写胶水代码，保证单一真实数据源（SSOT）。

## 根因与修复

### 根因分析
1. **服务端 Session CookieCache 缓存机制**：
   在 `src/auth.ts` 中启用了 Better Auth 的 Cookie 缓存（`session.cookieCache: { enabled: true, maxAge: 5 * 60 }`），5 分钟内服务端优先验证并解密 Cookie，不重复查询 D1 数据库。
2. **状态源割裂与双写缺陷**：
   此前头像更新逻辑调用了自建接口 `/api/account/profile`，直接用 Drizzle 更新数据库 `user.image`。
   然而 Better Auth 服务端并未参与该更新流程，客户端的 Session Cookie 签名未更新。前端虽然紧接着调用了 `refetchSession()`，但由于客户端携带的 Cookie 仍在 5 分钟有效期内，服务端直接返回了未过期的缓存 Session，导致客户端拿到的 `session.user.image` 依然是旧值。

### 修复方案（第一性原理与 SSOT）
1. **收敛至 Better Auth 单一数据源**：
   - 彻底废弃通过自建业务路由更新 `name` 与 `image` 的做法。
   - 在 `web/src/pages/Settings.tsx` 中，用户基础信息变更唯一调用 `authClient.updateUser`。
   - Better Auth 内部原子化完成：写 DB + 重新签名下发新 Session Cookie + 通过 `BroadcastChannel` 广播通知客户端刷新，所有 `useSession()` 订阅者即时响应。
2. **空间规则原生注入 Auth 钩子**：
   - 在 `src/auth.ts` 的 `databaseHooks.user.update.before` 中注入 `validateDisplayName` 与空间作者重名校验。
   - 无需自建胶水层即可确保双人空间业务约束在 Auth 核心层原生生效。
3. **职责清晰划分**：
   - Better Auth：管理 `name`、`image`、`email` 等核心身份资产。
   - `/api/account/profile`：仅保留 `birthday`、`voiceTranscribeMode`、`about` 等空间业务扩展字段。

## 回归验证

- `npm run web:build`：构建通过，0 错误。
- `npm run typecheck`：类型检查通过，0 错误。
- `npm test`：61 项单元与 API 回归测试全部通过。
- 点击预置头像与上传头像，Session Cookie 原子更新，UI 响应式即时渲染最新头像。
