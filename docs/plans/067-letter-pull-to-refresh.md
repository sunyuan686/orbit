# 信箱下拉刷新实施

> 创建：2026-10-09 · 状态：已完成

## 目标

为「信箱」列表页（`ArticleList.tsx`）接入通用 `PullToRefresh` 组件，实现触屏手势下拉刷新与底栏联动。

## 步骤

1. 在 `web/src/pages/ArticleList.tsx` 引入 `PullToRefresh`。
2. 构造 `handleRefresh` 逻辑，在信件模式下重新拉取 `letterQuery` 与 `statusQuery`。
3. 包裹 `PullToRefresh`，绑定 `tabKey={isLetter ? "letter" : undefined}`。
4. 运行 `npm run web:build` 验证类型安全与打包。

## 完成标准（可验证）

- [x] `PullToRefresh` 接入无胶水代码，代码改动少于 25 行。
- [x] `npm run web:build` 通过无报错。
- [x] 信箱列表下拉能正常触发刷新并平滑回弹。
