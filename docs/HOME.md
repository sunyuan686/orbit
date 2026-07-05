# 首页

> 登录后的默认落地页（`/`），聚合空间身份与近期内容，不承担完整列表或编辑职责。  
> 视觉规范见 [DESIGN.md](../DESIGN.md)；进度见 [ROADMAP.md](./ROADMAP.md)「空间与首页」。  
> 记录节奏热力图详见 [ACTIVITY.md](./ACTIVITY.md)。

---

## 定位

首页是双人空间的「客厅」，不是仪表盘：

- 第一眼看到「我们是谁、在一起多久」
- 快速进入各内容分区或新建
- 扫一眼最近写了什么、留了哪些图
- 感受最近的写作节奏（迷你热力图 + 连续天数）

不替代侧栏导航，也不复制各列表页的完整能力。

---

## 信息结构

自上而下六块；「最近照片」无图时隐藏：

| 区块 | 作用 |
|------|------|
| Hero | 双方爱称、在一起天数（或 slogan）、纪念日文案；链到空间档案 |
| 记录节奏 | 连续天数、活跃天摘要、12 周迷你热力图；链到 `/activity` |
| 快速记录 | 写日记 / 写信 / 留言 |
| 探索 | 六张导航卡：日记、时间线、留言板、信箱、备忘录、相册 |
| 最近照片 | 相册最新 8 张缩略图 |
| 最近动态 | 日记、时间线、留言、信件主信混排，按 `entryDate` 降序，最多 6 条 |

### Hero 两种状态

1. **已设纪念日**：大号天数（serif、tabular-nums）+ 起始日期；有 slogan 时附在下方  
2. **未设纪念日**：展示 slogan 或默认 tagline，引导去 `/settings?tab=space` 设置

爱称来自 `GET /api/space/status` 的 `authors`；天数与 slogan 来自 `SpaceContext`（`GET /api/space`）。

---

## 数据

无专用首页 API。首屏并行请求：

| 接口 | 用途 |
|------|------|
| `GET /api/space` | Hero：纪念日、slogan、天数 |
| `GET /api/space/status` | Hero：双方 `name` |
| `GET /api/stats/activity?days=365` | 记录节奏：streak、活跃天、热力数据（展示截取近 84 天） |
| `GET /api/articles?type=…` | 最近动态（diary / timeline / message / letter roots） |
| `GET /api/gallery?limit=8` | 最近照片 |

信件只取主信（`letter` + roots），避免回信刷屏。动态排序仅用 `entryDate`，不含 `createdAt`。

---

## 视觉与交互

- 容器宽度 `--layout-settings`（860px），宽于正文列表页，仍单列阅读友好  
- Hero：浅抬升底 + 弱径向点缀，天数用 heading 字体，克制不喧宾夺主  
- 记录节奏：一行 meta + 横向可滚动迷你热力图；样式复用 `orbit-activity-*`（`compact`）  
- 探索卡：图标 + 标题 + 一行说明，2/3 列响应式网格；hover / active 与全站按钮态一致  
- 照片：正方形缩略图网格，点击进入相册页（非单图 lightbox）  
- 动态列表：复用列表页的信息密度（类型标签、标题、作者、日期）

样式前缀 `orbit-home-*`，定义在 `web/src/index.css`。

---

## 代码

| 文件 | 说明 |
|------|------|
| `web/src/pages/Home.tsx` | 页面与数据组装 |
| `web/src/components/ActivityHeatmap.tsx` | 记录节奏迷你热力图 |
| `web/src/App.tsx` | `index` 路由 |
| `web/src/components/Layout.tsx` | 侧栏「首页」、`/` 页标题、品牌区回首页 |
| `web/src/components/OrbitIcons.tsx` | `HomeIcon` |

登录、邀请加入成功后默认跳转 `/`。

---

## 后续（未实现）

按优先级大致为：空间封面图进 Hero、内容统计小卡（篇数 / 照片数）、下一纪念日倒计时、通知摘要。具体排期以 ROADMAP 为准。
