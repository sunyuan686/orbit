# 系统整体按钮体系统一与新建相册按钮重构

> 创建：2026-09-07 · 
> 状态：已完成

## 目标

基于第一性原理，系统化重构按钮底层组件与样式规范：消除块级 SVG 与 Label 折行问题，统一设计系统圆角令牌与按压动效，消除各页面散落的硬编码补丁。

## 步骤

1. 重构基础组件 `Button.tsx`，支持 `shape`（`rounded` / `pill`）、`iconRight`，内部自动识别纯图标模式，按需包裹 label。
2. 完善 `index.css` 中 `.orbit-ui-btn` 体系样式，补充 `.orbit-ui-btn-label`、`.orbit-ui-btn-icon` 单向水平弹性流，引入 `--radius-md`、按压缩放与焦点环，对齐历史 `.orbit-btn`。
3. 规范重构 `Albums.tsx` 与 `AlbumDetail.tsx`，使用语义化 `Button` 属性。
4. 运行 `tsc` 与构建检查，记录修复文档与变更回顾。

## 完成标准（可验证）

- [x] `npx tsc --noEmit` 通过无类型报错
- [x] `npm run build` 构建成功
- [x] 按钮无换行、图标文字弹性对齐、胶囊按钮形态规范
