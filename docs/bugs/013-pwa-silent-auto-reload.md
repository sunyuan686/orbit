# 生产环境 PWA 静默整页自动刷新

> 创建：2026-09-01 ·
> 状态：已修复

## 现象

- 生产环境部署新版本后，用户切回标签页/聚焦窗口时页面**静默整页重载**，无任何提示。
- 编辑中的草稿、刮刮卡漫游状态等内存态全部丢失。

## 期望行为

- 整页重载是破坏性操作，其决策权属于用户：新版本就绪时弹出提示，用户在安全时机点击「立即刷新」后才激活新版本并重载。

## 根因与修复

**诊断修正记录**：最初误判为 `lib/pwa.ts` 的 `onNeedRefresh → updateSW(true)` 触发。核对 vite-plugin-pwa 运行时源码（`dist/client/build/register.js`）后确认：**autoUpdate 模式下 `onNeedRefresh` 回调永远不会被调用，`updateSW(true)` 是 no-op**——该文件两处更新逻辑均为死代码。真正的 reload 来自插件运行时默认行为：监听 SW `activated` 事件（`isUpdate=true`）→ 未传 `onNeedReload` 回调 → 直接 `window.location.reload()`。

**根本原因**：更新策略没有唯一 owner——项目叠加了三套机制（运行时 auto-reload / `sw.ts` 顶层 `skipWaiting()` / `pwa.ts` 的 `onNeedRefresh→updateSW`），两套死、一套活着但完全不可控。触发链：部署新版本 → 用户 focus 标签页（`registration.update()`）→ 新 SW 安装 → 顶层 `skipWaiting()` 立即激活接管 → 运行时硬 reload。

修复（`web/`）：

| 文件 | 变更 |
|---|---|
| `vite.config.ts` | `registerType: "autoUpdate"` → `"prompt"` |
| `src/sw.ts` | 删除顶层无条件 `self.skipWaiting()`；保留 `SKIP_WAITING` 消息监听（用户确认后接管）与 `clientsClaim()` |
| `src/components/SwUpdatePrompt.tsx` | 新增：SW 注册 + 「新版本可用」提示 UI。`onNeedRefresh`（prompt 模式下真实生效）置位 → 用户点击「立即刷新」→ `updateSW(true)` 发送 `SKIP_WAITING` → 新 SW 激活 → 运行时重载。保留原有 focus/visibilitychange 15 分钟节流的 `registration.update()` 检查；「暂不更新」可关闭提示 |
| `src/lib/pwa.ts` | 删除（死代码，职责并入 SwUpdatePrompt） |
| `src/main.tsx` / `src/App.tsx` | 移除 `registerPwaServiceWorker()`；`SwUpdatePrompt` 挂载于路由之外（登录页同样覆盖） |

更新后的契约：新 SW 安装 → waiting（旧版本继续服务）→ 用户点击刷新 → 激活 + 整页重载，全程应用与用户可见、可控。

注意：prompt 模式下用户忽略提示时，旧版本持续服务直至所有标签页关闭——这是契约的一部分，非缺陷。

## 回归验证

- `npm run typecheck` ✅、`npm run web:build` ✅、`npm run web:lint` 与基线一致（零新增）
- `dist/sw.js` 产物确认：顶层 `skipWaiting()` 不存在；`SKIP_WAITING` 消息处理保留
- 手动验证（需部署两次后）：
  1. 部署 v2 后切回已打开的 v1 标签页 → 应出现「新版本可用」提示，页面**不**自动刷新
  2. 点击「立即刷新」→ 新 SW 激活并整页重载，重载后运行 v2
  3. 点击「暂不更新」→ 提示消失，页面继续以 v1 运行
  4. 编辑器有未保存草稿时被提示更新 → 草稿不因静默重载丢失
