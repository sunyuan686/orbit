# 019 搜索 UI 与顶栏图标规范化重构计划

## 背景与目标
解决顶栏搜索图标与其它工具栏图标尺寸不统一（20px vs 16px）、移动端触控 Hover 残留背景块，以及搜索页面输入框采用古典大表单加实心绿色大按钮导致的视觉笨重和违背 60-30-10 设计原则问题。按照系统级最佳实践进行规范化重构。

## 修改范围
- `web/src/components/Layout.tsx`：统一顶栏图标尺寸为 `size="sm"` (16px)。
- `web/src/pages/Search.tsx`：重构搜索输入区为一体化内置搜索栏（内嵌 16px 搜索图标与清空按钮，移除实心绿色提交大按钮）。
- `web/src/index.css`：
  - 为 `.orbit-icon-btn:hover` 增加 `@media (hover: hover) and (pointer: fine)` 隔离，解决移动端 Sticky Hover 残留。
  - 新增一体化搜索栏设计 Token 样式（`.orbit-search-bar-wrap` 等）。

## 完成标准与验证
1. `npm run typecheck` 通过，无类型报错。
2. `npm run web:build` 成功打包。
3. 顶栏所有图标（菜单、搜索、通知、主题切换）视觉权重一致。
4. 移动端触控点击后无深灰底块残留。
5. 搜索页面输入框体验轻盈精致，支持回车搜索与一键清空。
