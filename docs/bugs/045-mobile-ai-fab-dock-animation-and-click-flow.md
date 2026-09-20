# 移动端 AI 悬浮球贴墙失效与双击唤醒问题

> 创建：2026-09-19 · 
> 状态：已修复

## 现象

在移动端/触控视口下：
- AI 悬浮球未能缩入屏幕右侧边缘半隐藏（呈现完整常驻圆形悬浮在右下角）。
- 需连续点击两次才能打开 AI 聊天面板，第一次点击视觉无反馈。

## 期望行为

- 移动端未打开面板时，AI 悬浮球处于半隐藏贴墙态（收缩入屏幕右边缘露出微弧半圆与图标，`opacity: 0.6`），降低视线干扰。
- 触控端轻触悬浮球时，一次点击即可直接打开 AI 聊天面板，无冗余前置探出步骤与等待延迟。
- 悬浮球关闭或失焦 3.5 秒后平滑缩回贴墙态，保持纯合成层（`transform`/`opacity`）无回流动画。

## 根因与修复

1. **CSS 动画层叠锁死**：
   - 全局 `.orbit-ai-fab:not(.orbit-ai-fab--hidden)` 设置了 `@keyframes orbit-ai-fab-enter` 且包含 `animation-fill-mode: both`。
   - CSS 关键帧层叠优先级高于常规类选择器，使得动画终态 `to { transform: translateY(0); opacity: 1; }` 持续接管并锁死属性，无条件覆盖了移动端媒体查询中的 `.orbit-ai-fab--docked { transform: translateX(38px); opacity: 0.6; }`。
   - 修复：入场动画作用域限制在桌面端（`@media (min-width: 768px)`）并移除 `both` 填充模式；在移动端明确声明 `animation: none`，保障移动端贴墙属性完全由状态驱动。
2. **移动端交互流冗余**：
   - `AiChatFab.tsx` 初态设为 `docked: true`，原本在 `handleClick` 中设计了“第 1 击展开圆球，第 2 击打开面板”的两段式交互。在视觉已被动画锁死的背景下，第 1 击视觉全无反馈，造成“点两下才开”的假死体验。
   - 修复：移除移动端多余的二段点击拦截，`handleClick` 直接调用 `onClick()` 打开面板；同时为按钮补充 `onFocus={handleExpand}` 与移动端 `:active` 触控微缩微移反馈（`translateX(34px) scale(0.96)`），兼顾键盘无障碍与触控即时响应。

## 回归验证

- `npm run web:build`：编译通过，无类型或打包错误。
- 浏览器实机验证（Chrome DevTools 视口 430x932）：
  - 悬浮球自然收缩入右侧边缘（`translateX(38px)`、半圆露显、`opacity: 0.6`）。
  - 单击悬浮球直接打开全屏 AI 聊天面板。
  - 点击“收起”关闭面板后，悬浮球展开常驻，3.5 秒无操作后自动平滑滑回贴墙半隐藏态。
