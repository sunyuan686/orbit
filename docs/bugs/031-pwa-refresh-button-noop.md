# 点击「立即刷新」无反应

> 创建：2026-09-05 ·
> 状态：已修复

## 现象

生产环境出现「新版本可用」横幅后，点击「立即刷新」按钮，页面无任何反应，既不重载也无 loading 反馈。

## 期望行为

- 点击「立即刷新」后按钮立即切换为「刷新中…」禁用态；
- 新 SW 激活接管后当前标签页整页重载至新版本；
- 其他标签页未点击更新，草稿不丢失。

## 根因与修复

**根因（三层失效叠加）**：

1. `applyPwaUpdate()` 调用 `updateSwFn(true)`（即 `virtual:pwa-register` 导出的函数）后直接 `return`。该函数内部带下划线的 `_reloadPage = true` 是未使用的占位参数——它仅向 SW 发 postMessage，**从不执行 `window.location.reload()`**。
2. `virtual:pwa-register`（workbox-window 封装）本期望内部的 `controlling` 事件自动触发 reload，但该监听器只在 workbox-window 自身检测到 `waiting` 时才挂载；而项目中通过原生 `registration.waiting` / `updatefound` 手动置位 `needRefresh` 时，workbox-window 的监听器根本没有被添加。
3. 即使监听器被添加，初次访问（`isUpdate = false`）场景下 workbox-window 会跳过 `reload`，触发浏览器的 isUpdate 经典 bug。

**修复（第一性原理重构，拒绝打补丁）**：

移除 `virtual:pwa-register` 与 `workbox-window` 客户端运行时胶水层，回归浏览器原生 Service Worker API：

| 文件 | 变更 |
|---|---|
| `vite.config.ts` | 添加 `injectRegister: null`，`vite-plugin-pwa` 仅作构建工具，不注入任何运行时注册脚本 |
| `src/hooks/usePwaUpdate.ts` | 移除 `import { registerSW } from "virtual:pwa-register"`；用 `navigator.serviceWorker.register("/sw.js")` 直接注册；新增 `refreshing` 状态；`applyPwaUpdate` 改为：监听单次 `controllerchange` → reload，设 1000ms 超时兜底，向 `waiting` worker 发 SKIP_WAITING |
| `src/components/SwUpdatePrompt.tsx` | 按钮接入 `refreshing` 态，点击后展示「刷新中…」并禁用 |
| `src/components/AboutSettingsPanel.tsx` | 「立即更新」按钮同步接入 `refreshing` loading 态 |

新约定：`applyPwaUpdate` 仅在调用者（当前标签页）执行重载，不触碰其他标签页，草稿安全契约（013）不变。

## 回归验证

- `npm run typecheck` ✅ 0 错误
- `npm run web:build` ✅ 构建成功，1693 个模块（较修复前少 2 个 workbox-window 胶水模块）
- `dist/index.html` 中无 workbox-window 注入脚本
- `dist/sw.js` 确认：`skipWaiting()` 仅在 `SKIP_WAITING` 消息中触发，无顶层无条件调用
- 手动验证：点击「立即刷新」→ 按钮即时变为「刷新中…」→ 新 SW 激活后整页重载
