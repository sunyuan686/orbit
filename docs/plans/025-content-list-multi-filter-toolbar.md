# 内容列表页「多维检索与视图控制一体化工具栏」施工计划

> 创建：2026-09-03 · 
> 状态：已完成

## 目标

基于第一性原理与微型下拉胶囊体系，在内容列表页（时间线、日记、留言等）构建完整自洽的多维工具栏，打通年份穿梭、作者专属视角、正倒序重温、卡片/列表切换与新建操作。

## 步骤

1. **后端 API 扩展（src/api/articles.ts）**：
   - `GET /api/articles` 扩展 `year`、`author`、`order`（`asc` | `desc`）纯净查询条件；
   - 移除原生 UTC 算术硬编码，全面对齐基准时区库（`src/shared/utils/date.ts`：`dateKeyToUnix`, `dateKeyToEndOfDayUnix`, `getSpaceYear`）；
   - 单次聚合查出 `earliestYear`（该类型最早一条记录的年份），与前端实现真实数据区间闭环。
2. **前端 API 客户端与信件树排序（web/src/lib/api.ts & letterThread.ts）**：
   - `fetchEntries` 扩展支持透传 `year`、`author`、`order`；
   - `buildLetterTree` 接入 `order` 参数，使信箱模式同样支持正倒序查看。
3. **前端工具栏组件与状态联动（web/src/pages/ArticleList.tsx & index.css）**：
   - 实现轻量无外部依赖的 `FilterChipDropdown` 微型下拉胶囊，支持点击外部及 `Esc` 键关闭；
   - 彻底废除纪念日硬算与 `currentYear - 3` 兜底，纯粹由 `[currentYear, earliestYear]` 真实区间生成选项；
   - 整合作者空间常驻视角、排序（`↓ 最新优先` / `↑ 最早优先`）、视图切换（`[ ☷ 卡片 ]`）与轻量新建；
   - 添加统一 30px 高度、浅边框与纸质微下拉浮层样式。
4. **验证与全模块覆盖**：
   - 验证年份、作者、正倒序、视图切换组合查询无误；
   - 执行 `npm run build`、`npm run typecheck`、`npm run test` 确保前后端编译与测试 0 错误。

## 完成标准（可验证）

- [x] `npm run build` 全模块 0 错误编译通过
- [x] 年份选择器点击展开下拉，选中后过滤生效并显示清除 `✕`
- [x] 作者选择器支持两人视角精准过滤
- [x] 时间流向支持正倒序一键切换
- [x] 视图模式（卡片 vs 列表）与新建操作和谐对齐
