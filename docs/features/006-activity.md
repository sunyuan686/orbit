# 记录活动（写作热力图）

> 可视化双人空间的写作节奏：按日聚合、连续记录（streak）、近一年热力图。  
> 创建：2026-07-05
> 进度见 [ROADMAP.md](../../ROADMAP.md)（Phase E · 热力图）。  
> 首页摘要见 [008-home.md](./008-home.md)「记录节奏」。

---

## 目标

回答「我们有多持续地在记录这段关系」，而不是「App 被点了多少次」。

- 按日历日汇总写作量，GitHub 贡献图式热力展示
- 连续记录天数（当前 streak / 历史最长）
- 点击某天查看当日条目并跳转详情

不替代各类型列表页，不做记账、相册上传等维度的混合统计。

---

## 统计口径

### 计入

| `entry.type` | 说明 |
|--------------|------|
| `diary` | 日记 |
| `timeline` | 时间线里程碑 |
| `message` | 留言板 |
| `letter` | 信箱（含主信与回信） |

- 日期字段：`entry.entry_date`（Unix 秒）
- 过滤：`deleted_at IS NULL`
- 同一天多篇：计数累加，热力格按档位加深

### 不计入

| 类型 | 理由 |
|------|------|
| `memo` | 活文档，编辑语义与「当日记录」不一致 |
| 评论 / 边注 | 互动，非创作 |
| 相册 `asset` | 独立维度，后续可做开关扩展 |

### 时区

日历日按**北京时间（UTC+8）**归桶，与前端 `formatDate()` 列表展示一致。

实现：`src/lib/beijing-date.ts`；避免依赖 SQLite `localtime`（Node / D1 环境不一致）。

### 数据库

**无新表、无 migration**。只读查询现有 `entry` 表，复用索引 `idx_entry_type_date`。

---

## 信息架构

### 详情页 `/activity`

侧栏「记录活动」；登录后可访问。

自上而下：

| 区块 | 内容 |
|------|------|
| 概览统计 | 当前连续、最长连续、范围内活跃天、总篇数 |
| 热力图 | 近一年（默认 365 天），周一为列首、按周排列 |
| 当日列表 | 点击格子后展示该日条目（再点同一格收起） |

### 首页摘要

位置：Hero 与「快速记录」之间，区块名「记录节奏」。

- 文案：连续 N 天 · 近 M 天活跃 K 天
- 迷你热力图：最近 12 周（84 天），`compact` 样式
- 「查看详情」→ `/activity`

首页请求 `GET /api/stats/activity?days=365`（streak 基于全年），展示时前端截取最近 84 天。

---

## Streak 规则

**GitHub 式**：

- **当前连续**：从今天往前数；若今天尚无记录，从昨天起算（今天结束前不断档）
- **最长连续**：统计范围内所有活跃日的最长连续段

活跃日定义：当日 `count > 0`（在请求的 `days` 窗口内）。

---

## 热力图档位

| 篇数 | 档位 | CSS |
|------|------|-----|
| 0 | 空 | `orbit-activity-cell--level-0` |
| 1 | 浅 | `level-1` |
| 2–3 | 中 | `level-2` |
| 4–5 | 深 | `level-3` |
| 6+ | 最深 | `level-4` |

色阶基于 `--color-accent` 与 `--color-surface-raised` 的 `color-mix`，亮 / 暗主题与 accent 预设自动适配。

---

## API

均需登录（`requireAuth`，与内容 API 一致）。路由挂载：`/api/stats/activity`。

### `GET /api/stats/activity?days=365`

查询参数：

| 参数 | 说明 | 默认 |
|------|------|------|
| `days` | 回溯日历天数，含今天；范围 7–730 | `365` |

响应：

```ts
{
  days: Array<{ date: string; count: number }>;  // YYYY-MM-DD，升序、连续无缺口
  streak: { current: number; longest: number };
  summary: {
    activeDays: number;    // count > 0 的天数
    totalEntries: number;  // 窗口内篇数合计
    rangeDays: number;     // 实际窗口长度
  };
}
```

### `GET /api/stats/activity?date=2026-07-05`

查询参数：

| 参数 | 说明 |
|------|------|
| `date` | `YYYY-MM-DD`，与统计口径相同的北京时间日界 |

响应：

```ts
{
  date: string;
  entries: Array<{
    id: string;
    type: string;
    title: string | null;
    author: string;
    entryDate: number | null;
  }>;
}
```

与 `?days` 互斥：传 `date` 时返回当日列表，不返回热力聚合。

---

## 视觉与交互

- 详情页容器：`--layout-settings`（860px），类名前缀 `orbit-activity-*`
- 热力图组件：`ActivityHeatmap`，支持 `compact`、`recentDays`、`onSelectDate`
- 格子：`button`（详情页可选中）或 `span`（首页只读）
- 横向可滚动（窄屏一整年约 52 列）
- `prefers-reduced-motion`：无额外动画，仅 hover 描边

样式定义：`web/src/index.css`。

---

## 实现对照

| 模块 | 路径 |
|------|------|
| 北京时间归日 | `src/lib/beijing-date.ts` |
| 聚合与 streak | `src/services/activity.ts` |
| HTTP 路由 | `src/api/activity.ts` |
| Node 挂载 | `src/server/routes/activity.ts`，`src/server/index.ts` |
| Worker 挂载 | `src/worker.ts` |
| 前端 API | `web/src/lib/api.ts`（`fetchActivityStats` 等） |
| 格子布局 / 档位 | `web/src/lib/activityHeatmap.ts` |
| 热力图组件 | `web/src/components/ActivityHeatmap.tsx` |
| 详情页 | `web/src/pages/Activity.tsx` |
| 首页摘要 | `web/src/pages/Home.tsx` |
| 路由 | `web/src/App.tsx`（`/activity` 须在 `/:type` 之前） |
| 侧栏 | `web/src/components/Layout.tsx`，`ActivityIcon` |

---

## 后续可扩展（未排期）

- 按作者拆分（谁写得多）或双人对比色
- 相册上传日叠加开关（「含照片」）
- 月份标签、周年竖线标注
- 列表页按日期筛选（点击格子深链到 `/diary?date=`）
- 飞书 `/week` 摘要附热力图链接
