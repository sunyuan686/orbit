# 信件详情页信纸样式简化与去胶水优化

> 创建：2026-09-09
> 状态：已完成

## 背景与问题

1. **写死的假堆叠阴影**：信件详情页的 `.orbit-letter-sheet` 通过 `box-shadow` 硬编码了第二层纸张偏移（`5px 7px 0 -2px var(--letter-paper)`），无论信件长短或是否为单封信，末尾都常驻露出一圈假叠纸。
2. **卡片嵌套胶水代码**：`ArticleView.tsx` 中外层是纯白大卡片 `article.orbit-article-sheet`，内层正文却通过胶水类 `${entry.type === "letter" ? " orbit-letter-sheet" : ""}` 单独套上米黄框，导致标题和正文被割裂在两个不同卡片里，读到末尾时出现“黄底纸边 + 假纸叠角 + 白卡留白 + 白卡底边”的双重嵌套。

## 第一性原理优化方案

信件本质上就是一封完整、宁静的书信，`article.orbit-article-sheet` 本身就是沉浸阅读纸张主体。
1. **移除内层胶水包裹**：将 `ArticleView.tsx` 内正文容器统一为 `flex-1 min-w-0`，使信件与日记、时间线等所有内容类型一样，自然在统一的纸张卡片上通透呈现。
2. **清理冗余拟物样式**：从 `web/src/index.css` 中彻底清理 `.orbit-letter-sheet`、硬编码的假堆叠 `box-shadow`、`::before` 装饰符号以及 3D 折叠动效。
3. **保持列表页真实语义**：列表页仅在真正存在回信时才按回信层级展示纸叠，详情页则纯净专注于见字如面的长文阅读。

## 涉及文件

- `docs/plans/046-letter-detail-sheet-simplification.md`（新增计划）
- `web/src/pages/ArticleView.tsx`（移除胶水判断）
- `web/src/index.css`（清理废弃拟物样式与假堆叠阴影）

## 完成标准

- [x] 信件详情页在正文读到底部时，无任何多余伪堆叠阴影与双重底边留白。
- [x] 移除 `ArticleView.tsx` 中特化的 `orbit-letter-sheet` 胶水判断，代码保持直白干净。
- [x] `npm --prefix web run build` 成功，无类型报错与构建异常。
