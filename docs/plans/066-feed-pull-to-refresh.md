# Feed 流下拉刷新工程实施

> 创建：2026-10-09 · 状态：已完成

## 目标

为 Feed 流（HomePage）实现轻量、高性能、零胶水代码的触屏手势下拉刷新机制，并打通底栏顶部点击联动刷新。

## 步骤

1. 编写统一轻量级 UI 容器组件 `web/src/components/ui/PullToRefresh.tsx`，使用标准 Touch 事件与 GPU 合成层变换（`translate3d`）。
2. 在 `web/src/components/ui/index.ts` 导出 `PullToRefresh`。
3. 在 `web/src/pages/Home.tsx` 中接入 `PullToRefresh`，绑定 `handleRefresh` 并联动 `pagedMomentsQuery.refetch()` 与 `statusQuery.refetch()`。
4. 在 `web/src/components/layout/TabKeepAliveHost.tsx` 与 `HomePage.tsx` 中打通在顶部再次点击 Tab 时的刷新事件广播。
5. 运行 `npm run web:build` 验证类型检查与生产环境构建。

## 完成标准（可验证）

- [x] `PullToRefresh` 组件结构清晰，无多余依赖，仅约 80-100 行。
- [x] `npm run web:build` 编译打包 100% 通过无告警。
- [x] 顶部下拉超过 56px 释放触发动态列表重新请求，刷新后平滑回弹。
- [x] 页面正常上滑、下滑及横滑时不产生任何手势冲突。
