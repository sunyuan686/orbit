# 统一无限滚动 (useInfiniteScroll) 与全站 Feed 流自动化

> 创建：2026-09-05 · 
> 状态：已完成

## 目标

从第一性原理出发，封装轻量统一且具备重入防护、视口自适应、优雅状态反馈的 `useInfiniteScroll` Hook 与 `InfiniteScrollSentinel` 组件，全站替换手动点击“加载更多”按钮，实现真正的无感流式体验。

## 步骤

1. 封装 `useInfiniteScroll` hook（基于 Callback Ref 与原生 IntersectionObserver，支持防抖防重、预加载、错误熔断与恢复）。
2. 封装 `InfiniteScrollSentinel` 组件（遵循 DESIGN.md 克制视觉规范，统一承载加载态、触底线与重试按钮）。
3. 导出组件与 Hook。
4. 改造 `Home.tsx`（首页动态流）。
5. 改造 `Gallery.tsx`（相册瀑布流）。
6. 改造 `ArticleList.tsx`（长文/日记/信件流）。
7. 执行 TypeScript 类型检查与全站 build 验证。

## 完成标准（可验证）

- [x] `web` 目录 `npm run build` 成功，类型检查 0 错误
- [x] `Home.tsx` 动态流实现平滑自动触底加载，移除手动“加载更多动态”按钮
- [x] `Gallery.tsx` 相册流支持自动触底无缝加载
- [x] `ArticleList.tsx` 列表支持自动触底加载
- [x] 状态完整：支持加载中动画、触底“已经看到最后了”底线、接口出错可手动重试恢复
