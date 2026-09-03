# 019 搜索 UI 与全局 Spotlight 搜索弹层规范化重构计划

## 背景与目标
解决顶栏搜索图标与其它工具栏图标尺寸不统一、移动端触控 Hover 残留背景块、WebKit 原生与自定义清空按钮重复出现两个“X”号，以及在 iOS PWA / 移动端下浮层弹窗全屏覆盖像独立空白页面、误展示实体键盘快捷键 Footer 的问题。
遵循跨端第一性原理（移动端悬浮卡片 + 半透明磨砂底色遮罩 + 安全区适配，彻底移除触屏端实体键盘底栏），建立真正轻盈、通透的全局搜索浮层体验。

## 修改范围
- `web/src/components/SearchModal.tsx`：
  - 自动聚焦与防失焦保护（`autoFocus`、清除按钮 `onMouseDown/onTouchStart` 阻止失焦）。
  - 移动端：悬浮半透明卡片，输入框左置放大镜图标与右侧“取消”按钮。
  - 彻底在移动端隐藏实体键盘快捷键 Footer（`display: none`）。
- `web/src/index.css`：
  - 移动端弹窗调整为纯正的**悬浮卡片（Floating Card Overlay）**，保留半透明磨砂遮罩（`rgba(0,0,0,0.45)` + `backdrop-filter: blur(8px)`），绝不把整个屏幕涂白/涂黑变成独立页面。
  - 严格适配 `env(safe-area-inset-top)` 安全区，确保稳稳居于灵动岛/状态栏下方。
  - 快捷键底栏严格仅在桌面端展现（`@media (min-width: 641px)`）。
- `web/src/components/Layout.tsx`：
  - 全局挂载 `SearchModal`，全端统一通过顶栏 `🔍` 或 `⌘K` 唤起。

## 完成标准与验证
1. `npm run typecheck` 通过，无类型报错。
2. `npm run web:build` 成功打包。
3. 移动端/PWA 下搜索呈现为半透明浮层卡片，底层原页面清晰可见且虚化，不再像独立空白页。
4. 移动端彻底移除无意义的 `↑↓ ↵ ESC` 实体按键提示。
5. 搜索栏避开灵动岛与状态栏，点击取消或空白处立即返回。
