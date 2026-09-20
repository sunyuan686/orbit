# 移动端与桌面端 App Shell 视口高度未约束导致内容滚动死锁

> 创建：2026-09-05 · 
> 状态：已修复

## 现象

在移动端浏览器仿真/真实设备及桌面端中，页面被锁死在首屏，无论使用触屏滑动还是鼠标滚轮，均无法向下滑动浏览历史动态、信件及相册内容。

## 期望行为

- 移动端页面在带有系统状态栏及底部原生导航栏的情况下，主内容区（`<main>`）充满视口剩余空间，支持平滑的原生上下滚动浏览（`-webkit-overflow-scrolling: touch;` 与 `overscroll-y-contain`）；
- 顶部 Header 状态栏与底部 TabBar 始终完好锚定，毛玻璃背景与安全区（`safe-area-inset-*`）避让清晰；
- 桌面端侧边栏固定不滚动，主内容画布（`<main>`）独立顺畅上下滚动。

## 根因与修复（零补丁·第一性原理）

1. **根因定位**：
   - 全局 App Shell 架构中，`web/index.html` 与 `web/src/index.css` 对 `html, body, #root` 声明了 `height: var(--viewport-height, 100vh); overflow: hidden;`，禁止全局 window 产生橡皮筋晃动。
   - Orbit 原生设计系统早在 `index.css` 中就定义了标准 App Shell 基础类 `.orbit-shell`（包含 `position: fixed; inset: 0; width: 100%; height: var(--viewport-height); overflow: hidden;`）以及联动选择器 `html.orbit-ai-open .orbit-shell main`。
   - 在重构 `MobileShell.tsx` 与 `DesktopShell.tsx` 时，未复用现有的 `.orbit-shell`，而是手写了 `min-h-screen flex flex-col`。
   - 在 CSS Flex 机制下，外层容器因缺少高度上限约束，被内部长内容持续撑大至 6105px，导致 `<main>` 计算高度为 6050px（`clientHeight == scrollHeight`）。
   - 浏览器认为 `<main>` 内部完全装得下内容，不产生滚动；同时外层又有 `overflow: hidden`，造成两层互相死锁。

2. **零补丁修复**：
   - **拒绝一切业务层补丁**：不写任何 JS 动态高度计算，不写任何 touch 事件劫持，不向具体业务页面注入特殊样式；
   - **回归核心设计系统**：直接在 `MobileShell.tsx` 与 `DesktopShell.tsx` 根容器应用已有的 `.orbit-shell flex flex-col`，恢复既定的视口包含块与全局设计系统联动；
   - 主内容区 `<main>` 声明标准 Flexbox 滚动规范 `flex-1 min-h-0 overflow-y-auto overscroll-y-contain`，由浏览器原生引擎驱动无阻塞滚动。

## 回归验证

- 通过 Chrome DevTools 仿真模式在 iPhone 16 Pro Max 尺寸下，验证 `canScroll: true`，执行 `scrollTop = 500` 滚动正常，截屏确认信件瀑布流向下滚动且底部避让正常；
- 在桌面端视口（1280x800）下，验证侧边栏固定且主内容画布 `canScroll: true`；
- 执行 `npm run typecheck` 与 `npm run web:build` 验证 0 错误编译通过。
