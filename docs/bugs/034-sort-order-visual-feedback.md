# 列表工具栏排序按钮无方向反馈且无法分辨升序降序

> 创建：2026-09-06 · 
> 状态：已修复

## 现象

动态页（Home）及内容列表页（ArticleList）顶部的排序按钮为写死的双向静态 Chevron 图标（`⇅`）。用户点击切换升序（最早优先）或降序（最新优先）时：
1. 图标完全不发生形态变化；
2. 按钮无任何激活态背景或边框变化；
3. 移动端无法悬停查看 `title` 提示，导致用户无法一眼辨别当前处于升序还是降序，亦无法直观确认点击是否已生效。

## 期望行为

- 保持纯 Icon 几何表现（无生硬文字），符合 Orbit 留白与克制美学；
- 排序状态切换时，图标呈现干净、居中、对称的纯粹方向箭头翻转反馈：
  - 降序（最新优先）：居中向下微箭头 `↓`（ArrowDownIcon）；
  - 升序（最早优先）：居中向上微箭头 `↑`（ArrowUpIcon）；
- 处于非默认排序（升序 / 最早优先）时，按钮赋予 `.is-active` 激活态底色与中性强化边框；
- 简洁直接，拒绝胶水代码与冗余封装。

## 根因与修复

1. **根因**：`web/src/components/OrbitIcons.tsx` 中 `SortIcon` 为硬编码双 Chevron 路径，不接收任何状态参数；调用方按钮样式亦无激活状态分支。
2. **修复**：
   - 在 `web/src/components/OrbitIcons.tsx` 中补全原生 `ArrowDownIcon`，与既有的 `ArrowUpIcon` 组成居中对称的 `SortDescIcon` 与 `SortAscIcon`，并让 `SortIcon` 支持接收 `order?: "asc" | "desc"` 属性自动分发；
   - 在 `web/src/pages/Home.tsx` 与 `web/src/pages/ArticleList.tsx` 中，根据 `order` 动态传入 `<SortIcon order={order} />` 并在 `order === "asc"` 时增加 `is-active` 类名；
   - 在 `web/src/index.css` 中为 `.orbit-filter-action-btn.is-active` 补充基于 CSS Token 的激活态与悬停样式。

## 回归验证

- `npm run web:build` 与 `npm run typecheck` 验证通过；
- 首页及文章列表页排序按钮在降序（最新优先）与升序（最早优先）状态下，图标正确翻转，居中端正，激活态背景准确呈现。
