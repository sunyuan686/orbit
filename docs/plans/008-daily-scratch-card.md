# 时光刮刮乐重构（每日限定 + 随心漫游）

> 创建：2026-08-25 · 
> 状态：已完成

## 目标

将首页固定展示最新动态的刮刮彩重构为每日专属同频卡与随心漫游探索双模式，实现那年今日检索、日期种子算法、本地揭晓持久化与无限漫游抽卡。

## 步骤

1. 编写后端服务 `src/services/companion/scratch-card.ts`，实现 `getDailyScratchCard` 与 `getRandomScratchCard`。
2. 接入后端 API `src/api/memories.ts`（`GET /api/memories/scratch-card` 与 `GET /api/memories/scratch-card/random`）。
3. 扩展前端 API 客户端 `web/src/lib/api.ts` 与 queryKeys。
4. 增强 `web/src/components/ScratchCard.tsx`（涂层自定义文案与揭晓控制）。
5. 改造 `web/src/pages/Home.tsx`，对接今日卡、localStorage 持久化与漫游抽卡流程。
6. 类型检查与构建验证。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 通过
- [x] 页面正常展示今日卡，划开后刷新保持揭晓状态
- [x] 点击「时光漫游 · 再刮一张」可正常抽取新卡并重新覆膜
