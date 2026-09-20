# 往来信件切换剧烈抖动与闪烁

> 创建：2026-09-09
> 状态：已修复

## 问题描述

在信箱信件详情页的“往来信件”面板中，点击不同信件进行切换时，页面出现明显的抽搐、抖动与闪烁，阅读体验不连贯。

## 根因分析

1. **整页 DOM 销毁坍塌**：在 `ArticleView.tsx` 中，`useParams` 的 `id` 变化时，`entryQuery` 默认将未决数据重置为 `undefined`，触发 `if (!entry) return <p>加载中…</p>`。整张信纸卡片及几千字正文瞬间被从 DOM 中卸载，随后再挂载，造成高度突变与闪白。
2. **往来面板本地 loading 折叠**：在 `LetterThreadPanel.tsx` 中，以本地 `useState(true)` 且依赖 `[entry]`。切换信件时先执行 `setLoading(true)`，将 150px 的往来列表折叠为 40px 的提示文字，造成下方正文剧烈跳动 110px（严重 CLS）。
3. **滚动条宽度跳变**：高度坍塌触发垂直滚动条短暂消失又出现，造成 15px 的横向左右抽搐。

## 修复方案

1. **Keep Previous Data**：在 `ArticleView.tsx` 的 `entryQuery` 中接入 `placeholderData: keepPreviousData`，切换信件期间稳定维持旧页面，新信件就绪后平滑替换，彻底杜绝整页 DOM 坍塌。
2. **React Query 缓存信件串**：在 `LetterThreadPanel.tsx` 中以 `resolvedRootId` 作为缓存键，同一个往来信件串内切换信件时复用已有的信件列表，仅切换“正在读”状态，面板高度完全静止。
3. **信件预加载 (Prefetch)**：在往来信件项 hover 时静默预取详情，使点击切换零延迟即时呈现。
4. **稳定滚动条槽位**：滚动容器配置 `scrollbar-gutter: stable`，消除滚动条显隐带来的横向晃动。

## 涉及文件

- `docs/bugs/037-letter-thread-switch-jitter.md`
- `web/src/pages/ArticleView.tsx`
- `web/src/components/LetterThreadPanel.tsx`
- `web/src/index.css`

## 完成标准

- [x] 点击切换往来信件时，页面无整页闪白、无 DOM 坍塌。
- [x] 往来信件面板高度恒定，仅更新“正在读”状态指示，无任何高度折叠跳动。
- [x] `npm --prefix web run build` 成功，无类型报错。
