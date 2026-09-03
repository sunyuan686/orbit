# 全项目统一空间时区与日期体系改造

> 创建：2026-09-02 · 
> 状态：已完成

## 目标

从第一性原理出发，彻底消除因 UTC `toISOString()`、客户端本地时区分量与服务器时区分歧导致的日期/时间错位问题，建立以「北京时间 (Asia/Shanghai, UTC+8)」为单一事实来源的统一空间时区架构。

## 步骤

1. 核心层：在 `src/shared/utils/date.ts` 中构建完整的空间时区与日期工具集（`getSpaceTodayKey`、`dateKeyToUnix`、`formatDate`、`formatDateTime`、`formatDateWithWeekday` 等），并由 `@orbit/shared` 导出。
2. 清理层：`src/lib/beijing-date.ts` 与 `src/shared/utils/beijing-date.ts` 纯代理 `@orbit/shared`，保持向后兼容。
3. 前端层：
   - `web/src/components/ScratchCard.tsx`：移除 `toISOString().slice(0, 10)`，改为统一 `getSpaceTodayKey()`。
   - `web/src/pages/Home.tsx`：移除私有 `getTodayDateKey()`，统一使用 `getSpaceTodayKey()`。
   - `web/src/lib/dateInput.ts` 与 `web/src/lib/api.ts`：统一桥接到 `@orbit/shared` 核心工具。
   - `web/src/components/CommentSection.tsx` 与 `MarginaliaRail.tsx`：统一使用 `formatDateTime`，消除时分混拼。
   - `web/src/components/AiConversationList.tsx` 与 `Memories.tsx`：统一相对时间与年份计算。
4. 服务层：`companion-engine` 与 `feishu-time` 接入统一时区工具。
5. 验证与规范：编写自动化单元测试 `src/shared/utils/date.test.ts`，新增 `docs/guides/space-timezone.md` 规范。

## 完成标准（可验证）

- [x] `src/shared/utils/date.test.ts` 跨午夜临界点与格式化单元测试全部通过（17/17 pass）
- [x] `npm run typecheck` 全项目类型检查通过
- [x] `npm run web:build` 前端构建打包通过
- [x] 刮刮卡与首页 Feed 在 0 点~8 点期间始终保持当天日期
