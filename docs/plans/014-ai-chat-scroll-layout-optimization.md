# AI Chat 滚动条与阅读排版解耦优化

> 创建：2026-08-29
> 状态：已完成

## 目标

解决 AI 对话面板（尤其是全屏/宽屏模式）下滚动条紧贴中央正文产生视觉压迫的问题：将滚动条归位至视口/面板最右侧，中央正文独立居中排版，并升级浮动胶囊滚动条与负空间留白。

## 步骤

1. **DOM 结构重构**：在 `web/src/components/AiChatPanel.tsx` 中的 `.orbit-ai-messages` 内部引入 `.orbit-ai-messages-inner` 居中排版层。
2. **滚动与居中样式解耦**：在 `web/src/index.css` 中重构 `.orbit-ai-panel--fullscreen`、`.orbit-ai-chat-main`、`.orbit-ai-messages`、`.orbit-ai-composer` 的响应式宽度与边距。
3. **滚动条精致化**：升级浮动胶囊滚动条样式（`background-clip: padding-box`、`border: 2px solid transparent`、低对比度微感知颜色）。
4. **全模式验证**：在全屏（Fullscreen）、侧边栏（Sidebar）、悬浮窗（Floating）及移动端下验证滚动交互与视觉呼吸感。

## 完成标准（可验证）

- [x] `pnpm --filter web typecheck` / `pnpm --filter web build` 检查通过
- [x] 全屏模式下滚动条位于屏幕最右边缘，中央正文以 46rem 优雅居中，两侧拥有充足负空间
- [x] 侧边栏/悬浮窗模式下内容与滚动条保持舒适安全间距（>16px~20px）
- [x] 滚动条在亮色/暗色模式下均为精致半透明浮动胶囊，不侵占阅读视线
