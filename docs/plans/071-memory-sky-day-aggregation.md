# 记忆星空按日聚合重构（第一性原理去打补丁）

> 创建：2026-10-10 · 状态：已完成

## 目标

解决记忆星空因调用条目分页接口导致的「数据被截断至 100 篇、点亮天数严重缩水失真、UI 暴露技术性调试括号 `(展示最近 100 / 共 329 篇)`」问题。
从第一性原理出发，将星空视图从「条目列表驱动」彻底解耦为「按日聚合驱动」，实现历史星辰 100% 全量轻量呈现与文案纯粹化。

## 步骤

1. **后端星图聚合服务**：在 `src/services/companion/love-memories.ts` 实现 `getMemorySky`，从数据库一次性拉取轻量日期数据并按日聚合，返回 `{ days, totalDays, totalEntries }`。
2. **后端 API 路由**：在 `src/api/memories.ts` 暴露 `GET /api/memories/sky`。
3. **前端 API 契约**：在 `web/src/lib/api.ts` 与 `web/src/lib/queryKeys.ts` 接入 `fetchMemorySky`。
4. **前端星空视图重构**：`web/src/pages/Memories.tsx` 切换为消费专用的星图数据，移除技术性截断文案，展示真实的 `我们一起点亮了 X 个日子`。
5. **自动化测试验证**：新增 `GET /api/memories/sky` 聚合逻辑回归测试，运行 `typecheck`、`web:build` 与 `npm test`。

## 完成标准（可验证）

- [x] 后端 `GET /api/memories/sky` 正确返回全量去重的点亮天数与条目
- [x] 前端星空图移除 `（展示最近 100 / 共 329 篇）`，显示真实点亮天数
- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 通过
- [x] `npm test` 全量通过
