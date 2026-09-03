# 空间统一时区与日期规范 (Space Timezone Guidelines)

## 核心原则（第一性原理）

1. **单一基准时区**：
   - Orbit 是双人专属空间，空间日历日（今日卡片、在一起天数、回忆打捞、活跃度热力图、日记日界等）和时间展示一律以 **北京时间（Asia/Shanghai，UTC+8）** 为唯一事实来源。
   - 无论用户浏览器、手机系统或服务器环境处于哪个物理时区，空间业务逻辑永不分裂。

2. **绝对时间 vs 业务日历日**：
   - **绝对时间点（Instant）**：数据库与网络交互统一采用 Unix Epoch 秒（`createdAt`, `updatedAt`, `entryDate`）。
   - **业务日历日（Calendar Date）**：一律采用 `YYYY-MM-DD` 格式的 dateKey，通过 `@orbit/shared` 转换。

## 开发铁律（DOs & DON'Ts）

### ❌ 严禁行为
1. **严禁在业务中直接调用原生 UTC 转换获取日历日**：
   ```ts
   // ❌ 错误：在东八区 00:00~07:59 会返回昨天的日期！
   const today = new Date().toISOString().slice(0, 10);
   ```
2. **严禁拼凑不同时区的分量**：
   ```ts
   // ❌ 错误：年月日是北京时间，时分是本地浏览器时间，时区撕裂！
   const date = formatDate(ts);
   const hh = new Date(ts * 1000).getHours();
   ```
3. **严禁手写 `+ 8 * 3600` 或重复实现时间工具**。

---

### ✅ 正确做法

一律通过 `@orbit/shared`（或前端 `web/src/lib/api` / `dateInput`）使用统一工具：

```ts
import {
  getSpaceTodayKey,
  dateKeyToUnix,
  unixToDateKey,
  formatDate,
  formatDateTime,
  formatDateWithWeekday,
  formatRelativeTime,
} from "@orbit/shared";

// 1. 获取今天日期 key (YYYY-MM-DD)
const today = getSpaceTodayKey();

// 2. 格式化展示
const displayDate = formatDate(ts);            // "2026-09-02"
const displayDateTime = formatDateTime(ts);    // "2026-09-02 14:05"
const displayWithWeek = formatDateWithWeekday(ts); // "2026 年 9 月 2 日 · 星期三"
const relative = formatRelativeTime(ts);       // 今天显示 "14:05"，其他天显示 "9月2日"

// 3. 日界与时间戳转换
const startOfDayTs = dateKeyToUnix("2026-09-02"); // 空间当天 00:00:00 Unix 秒
const dayKey = unixToDateKey(ts);                // Unix 秒转空间 YYYY-MM-DD
```
