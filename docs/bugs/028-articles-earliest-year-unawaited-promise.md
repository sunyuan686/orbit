# 内容列表年份筛选仅显示当前年份且历史年份缺失

> 创建：2026-09-05 · 
> 状态：已修复

## 现象

日记、随想等内容列表页面的顶部工具栏中，展开「年份 ·」下拉菜单时，仅显示「全部」与「2026 年」，而线上数据库实际存在从 2022 年至 2026 年（共 93 篇）的历史日记数据。

## 期望行为

- 后端分页列表接口返回该内容类型全局最早一条记录的真实年份 `earliestYear`；
- 前端年份筛选下拉框根据真实年份区间 `[earliestYear ... currentYear]` 完整渲染可选项（2022 年 ~ 2026 年）；
- 滚动翻页加载更多（`offset > 0`）时不重复触发全表扫描聚合查询，降低 D1 消耗；
- 前后端当前年份基准时区完全对齐空间基准时区（Asia/Shanghai）。

## 根因与修复

1. **异步未等待（Unawaited Promise）**：
   - 根因：`src/api/articles.ts` 中查询最早日期的语句 `earliestRow = page.paginate ? db.select(...min(entryDate)).where(...).get() : null` 返回的是 Promise 实例，但其后的 `Promise.all` 仅包含了 `[listQuery, countQuery]`，漏掉了 `earliestRow`。
   - 影响：在 Cloudflare D1 异步执行环境下，直接访问未解析的 `earliestRow?.minDate` 永远为 `undefined`，触发三元表达式 fallback `getSpaceYear()` 返回当前系统年份 2026，导致接口返回 `earliestYear: 2026`。
   - 修复：将其明确重命名为 `earliestQuery`，类型约束为 `Promise<{ minDate: number | null } | undefined> | null`，并纳入 `Promise.all([listQuery, countQuery, earliestQuery])` 显式解构为已解析的 `earliestRow`。
2. **第一性原理资源优化（零冗余查询）**：
   - 根因：翻页加载（`offset > 0`）时，前端仅消费第 0 页元数据，后端却在每一次翻页时都重复对全局数据执行 `min(entryDate)` 扫描。
   - 修复：仅在 `page.paginate && page.offset === 0` 时触发聚合查询，翻页时直接跳过，降低 D1 计算与行读取成本。
3. **前端时区对齐**：
   - 将 `web/src/pages/ArticleList.tsx` 中的 `new Date().getFullYear()` 统一为空间基准时区 `getSpaceYear()`，消灭跨时区客户端在跨年边界漂移风险。

## 回归验证

- 编写并运行单元测试套件 `tests/articles-year.test.ts`（包含异步解析、重现与防范 unawaited promise、空库兜底、翻页跳过、年份序列生成），5/5 测试通过；
- 运行完整测试套件 `pnpm test`（`tests/*.test.ts`），22/22 测试全部通过；
- 执行 `pnpm typecheck` 与 `pnpm web:build` 验证前后端 0 报错通过。
