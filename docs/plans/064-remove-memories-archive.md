# 记忆星图移除冗余回忆档案

> 创建：2026-10-08 ·
> 状态：已完成

## 目标

从第一性原理出发，彻底清理记忆星图（`/memories`）中与动态/信箱重复的全量“回忆档案”平铺列表及冗余请求与样式，聚焦星空天幕、相伴里程碑与全景热力图。

## 步骤

1. 在 `web/src/pages/Memories.tsx` 中移除“回忆档案”Section、类型/年份筛选状态、`archiveQuery` 请求及无用 import（`GalleryImage`、`getSpaceYear`、`TYPE_TABS`）。
2. 在 `web/src/index.css` 中清理回忆档案网格与卡片相关专属样式（`orbit-memory-card*`、`orbit-memory-chip`、`orbit-memory-filter*`）及历史死样式。
3. 运行 `npm run web:build` 与测试验证，确保类型检查无错误、构建通过。
4. 在浏览器中验证记忆星图页面视觉与交互表现。

## 完成标准（可验证）

- [x] `npm run web:build` 构建通过，0 错误
- [x] 记忆星图（`/memories`）页面干净聚焦：保留记忆星空（点选查看当日回忆）、相伴成就与里程碑、总体记录热力，无冗余档案列表
- [x] 无冗余网络请求（无 `archiveQuery` 额外拉取 60 条节点）
