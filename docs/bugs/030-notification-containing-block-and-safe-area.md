# 移动端通知面板包含块逃逸与沉浸式路由安全区重叠

> 创建：2026-09-05 · 
> 状态：已修复

## 现象

1. **移动端点击通知面板异常**：点击顶栏通知铃铛时，面板未在屏幕底部展开，而是发生错位漂移，大半截面板向上伸展至负坐标区域（`top: -140px`），标题、关闭按钮、未读数全部不可见，仅在屏幕最顶部露出一张通知卡片；且全屏背景遮罩仅覆盖顶部 Header，遮罩失效；
2. **长篇写作等沉浸式页面状态栏重叠**：进入长篇写作（`/moment/new`、`/articles/:id/edit`）或文章详情页面时，页面顶部的返回按键 `←`、作者日期、`保存` 按钮与手机系统状态栏（时间、电池、WiFi 信号）严重重合贴死。

## 期望行为

1. **通知面板（抽屉）**：在移动端点击通知铃铛时，底部抽屉自屏幕物理底端顺畅滑出，全屏背景虚化遮罩完整覆盖整个视口，抽屉拖拽手柄、通知标题、全部已读、关闭按钮及所有通知卡片正常呈现；
2. **沉浸式页面安全区**：所有二级沉浸式页面（包括长篇写作、文章阅读、回信等）在隐藏全局导航栏后，容器顶层自动提供物理安全区保护（`env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)`），内容自适应避让手机硬件刘海与灵动岛，各子页面保持纯净，无须硬编码补丁。

## 根因与修复（零补丁·系统性解决一类问题）

### 1. 通知面板包含块失效（CSS Containing Block 陷阱）
- **根因**：`NotificationBell` 挂载在 `MobileShell` 的 `<header className="... backdrop-blur-md">` 内部。按照 W3C 规范，任何包含 `backdrop-filter`、`filter` 或 `transform` 的祖先元素都会强行成为后代 `position: fixed` 的包含块。这导致 `.orbit-notification-panel` 的 `bottom: 0` 变成了贴合在 54px 的 Header 底部，面板高度 194px 向上生长，计算出 `top = -140px`，产生逃逸错位；
- **修复**：遵循全局浮层设计黄金法则，引入 React `createPortal`，在移动端展开时将遮罩与面板通过 `createPortal(content, document.body)` 脱离局部 DOM 树直接挂载至根节点，彻底消除任何局部父级滤镜与变换的包含块干扰。

### 2. 沉浸式路由安全区契约缺失
- **根因**：普通页面由全局 Header 统一避让 `env(safe-area-inset-top)`；但在二级沉浸式路由下，全局 Header 被隐藏，而外壳 `<main>` 仅设置了固定的 `py-3`（12px），丢失了系统安全区边距；
- **修复**：拒绝在 `ArticleEdit.tsx` 等业务页面逐一手写局部补丁，直接在 `MobileShell` 外壳契约层统一收敛沉浸式安全区规范：对所有 `isImmersive` 路由统一注入 `pt-[max(env(safe-area-inset-top,0px),0.75rem)] pb-[max(env(safe-area-inset-bottom,0px),2rem)]`，一次性系统化解决所有全屏二级页面的避让问题。

## 回归验证

- 通过 Chrome DevTools 仿真模式（iPhone 16 Pro Max 430×932）验证：
  - 点击通知铃铛：抽屉精准自底部展开，`panelRef` 位于 `bottom: 0px`，遮罩全屏生效，关闭与拖拽手柄正常；
  - 访问长篇写作（`/moment/new`）：顶部操作栏距视口顶部安全区 47px+，返回键与保存按钮与系统状态栏完全避让，无重叠；
- 执行 `npm run typecheck` 与 `npm run web:build` 0 错误编译通过；
- 验证完毕后恢复浏览器至首页标准视图，关闭所有临时弹窗。
