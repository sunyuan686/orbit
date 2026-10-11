# 下拉筛选菜单滑动导致底层页面内容滑动

> 创建：2026-10-06 ·
> 状态：已修复

## 现象

信箱（以及其它使用 `FilterChipDropdown` 的页面）在点击“时间”或其它筛选下拉框后，手指在展开的菜单区域内上下滑动，会导致背后的信件列表/页面内容随之上下滑动。

## 期望行为

- 筛选下拉菜单属于锚定式轻量浮层（Lightweight Popover）。
- 当菜单内容较少不需要内部滚动时（如信箱时间仅 6 项），在菜单区域内的滑动手势不应驱动底层页面内容滑动。
- 当菜单内容超长出现内部滚动条时，仅在菜单内部滚动，不应穿透驱动底层页面。
- 当用户意图浏览页面而在外部触发页面滚动时，下拉菜单应自动顺畅收起（Dismiss on Scroll），不阻断原生平滑滚动。
- 遵循现代 Web 规范与最佳实践，不采用全局被动事件拦截等补丁式代码。

## 根因与修复

### 根因
1. `FilterChipDropdown.tsx` 原先使用 `window.addEventListener("touchmove", ..., { passive: false })` 作为防滚补丁，仅对外部调用了 `preventDefault()`，而在菜单内部滑动手势被放行。
2. 菜单 CSS 声明了 `touch-action: pan-y`，当选项高度未达到 `max-height` 限制时，菜单本身不可滚动，浏览器直接将滑动手势冒泡分派至祖先滚动视口（`.orbit-tab-viewport`），造成内容滑动。
3. 全局非 passive 监听器违背现代 Web 性能规范，缺乏标准的轻量浮层视口滚动收起机制（Dismiss on Scroll）。

### 修复
1. **彻底移除全局 `touchmove` 补丁**：清除所有 `touchmove` 监听，消除主线程滚动阻塞。
2. **轻量浮层滚动即收起（Dismiss on Scroll）**：在展开状态下通过捕获阶段（`capture: true, passive: true`）监听滚动容器的 `scroll` 事件；当滚动源非菜单自身时自动收起菜单。
3. **声明式手势隔离（`touch-action`）**：
   - 当菜单内容不可滚动时，应用 `touch-action: none`，声明式禁止浏览器将手势识别为平移滚动；
   - 当菜单内容溢出产生滚动条时，标记 `.is-scrollable` 并启用 `touch-action: pan-y` 与 `overscroll-behavior: contain`，仅允许内部滚动。

## 回归验证

- 信箱时间选择器（6 项）展开后，在选项区域触摸滑动，背后信件列表不滑动。
- 选项可以正常点击切换年份并收起。
- 展开后滚动底层页面，菜单自动自然收起。
- `npm run web:build` 类型与构建通过。
