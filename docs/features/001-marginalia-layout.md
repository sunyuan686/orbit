# Orbit 边注与评论布局设计方案

> v0.4 · 已定稿 · **本期仅改阅读页** `ArticleView`（不含 `ArticleEdit`）

参考：[飞书文档目录/评论](https://www.feishu.cn/hc/en-US/articles/178968744708-use-headings-and-table-of-contents-in-docs)、[Notion 浮动目录](https://www.notion.com/en-gb/help/columns-headings-and-dividers)

---

## 1. 目标

| 类型 | 定位 | 桌面位置 | 默认状态 |
|------|------|----------|----------|
| **TOC** | 标题结构导航 | **正文左侧**细轨 | **收起**（Notion dash / pin） |
| **边注** | 对选中文字的批注 | **正文右侧**轨 | **收起**（飞书 Comments） |
| **评论** | 对整篇的讨论 | **文末** | 常显（有评论能力时） |

窄屏：TOC、边注均为 **FAB + Sheet**（边注 FAB 偏上，TOC FAB 贴底右）。

原则：左结构、右批注、底讨论——三者分区，不 Tab 切换。侧栏**默认不占阅读宽度**，按需展开；偏好写入 `localStorage`。

能力矩阵：`web/src/lib/commentCapabilities.ts`（diary/timeline/memo 双边注+评论，letter 仅边注，message 均无）。

---

## 2. 现状与问题

- 边注列表与评论同在底部 `CommentSection`，样式混同
- 桌面 TOC **常开**占右侧 `w-56`，与计划中的边注轨争抢空间
- 未借鉴飞书/Notion 的 **默认收起** 策略，阅读时 chrome 过重

---

## 3. 参考借鉴

| 来源 | 借鉴 | 不借鉴 |
|------|------|--------|
| **飞书 Comments** | 右侧独立轨；引文+批注卡片；`>>` 收起；**默认折叠** | 浅蓝底、头像密度、帮助浮动钮 |
| **飞书 catalogue** | **左侧**目录；pin/展开；**收起偏好可记忆** | 左栏常开全宽 |
| **Notion 浮动 TOC** | 收起态 **短横线轨**（H2 长/H3 短）；hover/点击展开；scroll spy | 块级+浮动双轨并存 |

---

## 4. 桌面布局（`xl+`）

对称三区：**左 TOC · 中正文 · 右边注**。两侧轨收起时各约 24–32px，**阅读页可维持 `layout-article: 900px`**，不必扩至 1100px。

### 收起（默认）

```
┌┬────────────────┬┐
│▌│ 正文 + 高亮     │▌│   ← 左：TOC dash 轨 / pin
│ │                │2│   ← 右：边注计数条（无则隐藏）
│ │ 文末 · 评论     │ │
└┴────────────────┴┘
```

### 展开（用户点击或交互触发）

```
┌────────┬────────────────┬──────────┐
│ 目录    │ 正文 + 高亮     │ 边注 (2) │
│ w-56   │                │ w-56     │
│ sticky │ 文末 · 评论     │ sticky   │
└────────┴────────────────┴──────────┘
```

### 显隐规则

| 场景 | 左 TOC | 右边注轨 |
|------|--------|----------|
| 有标题 | 收起条（可展开） | — |
| 有边注或起草中 | — | 收起条（可展开） |
| 0 条边注且无草稿 | — | **不渲染** |
| letter（无底部评论） | 按标题 | 按边注 |
| message | 按标题 | 隐藏 |

### TOC 状态（左轨）

| 状态 | 表现 |
|------|------|
| **collapsed** | 左侧细轨：当前节 dash 指示（Notion）+ pin 图标（飞书）；点击或 hover 展开 |
| **expanded** | `w-56` 完整标题列表 + scroll spy；左上角收起钮 |
| **记忆** | `localStorage` 键 `orbit-toc-expanded` |

### 边注状态（右轨）

| 状态 | 表现 |
|------|------|
| **collapsed** | 右侧细条：`边注 · N` 或图标；点击展开 |
| **expanded** | `w-56` 卡片列表（引文 + meta + 正文）；`>>` 或等效钮收起 |
| **auto-expand** | 点击正文琥珀高亮、新建边注起草 → 自动展开并 `scrollIntoView` |
| **记忆** | `localStorage` 键 `orbit-marginalia-expanded`（0 条时不写） |

两侧**可同时展开**；若视口过窄（`< xl`），退回移动方案。

---

## 5. 窄屏（`< xl`）

与 v0.3 一致，侧栏改为按需入口：

- **TOC**：右下角 FAB + 底部 Sheet（现有 `MobileToc`）
- **边注**：右下偏上 FAB + Sheet；点高亮/起草自动打开
- **评论**：文末 `CommentSection`

---

## 6. 组件

| 动作 | 说明 |
|------|------|
| **新增** | `MarginaliaRail`（含 collapsed/expanded）、`MobileMarginalia`、`MarginaliaCard` |
| **改** | `TableOfContents` → 支持左轨收起/展开 + `localStorage`；`CommentSection` 仅评论；`ArticleView` 三区组装 |
| **不变** | `TiptapEditor` 锚定、`anchor.ts`、API |

### 边注卡片（对齐飞书 Comments 结构）

1. 顶部：引文（`.orbit-comment-quote`，竖线 + 截断原文）
2. 中部：作者 + 时间（一行，无大头像）
3. 底部：批注正文；可删除

### 交互

- `activeInlineCommentId`：高亮 ↔ 右边注卡片双向联动；列表按 `anchorFrom` 排序
- 边注不可回复；评论在文末可线程回复

### 样式

- `.orbit-toc-rail` / `.orbit-toc-rail--collapsed` / `.orbit-toc-rail--expanded`
- `.orbit-marginalia-rail` / `--collapsed` / `--expanded`；卡片激活态左边框 `highlight-comment-border`
- `.orbit-comments` 仅评论；`margin-top: var(--space-section)`
- 移动 Sheet 复用 `.orbit-toc-drawer-*`

---

## 7. 本期范围

**只改 `ArticleView`。**

`ArticleEdit` 无边注 UI；保存时后台重映射锚点。编辑页侧栏展示/添加边注 → **P4**，与本期无依赖。

---

## 8. 实现分期

| 阶段 | 内容 | 状态 |
|------|------|------|
| **P1** | 拆 `CommentSection`；`MarginaliaRail`；`TocRail` | ✅ |
| **P2** | `MobileMarginalia`；高亮/起草自动开 Sheet | ✅ |
| **P3** | `localStorage`、`index.css`、`DESIGN.md` / skill | ✅ |
| **P4**（后做） | 编辑页边注（可选） | — |

---

## 9. 明确不做

- TOC 与边注 Tab 切换
- 正文 margin 逐条浮卡定位（Google Docs 式）
- 顶部 💬 汇总、resolve 工作流、边注回复线程
- 飞书浅蓝侧栏、企业级头像密度

---

## 10. 验收

- [x] 边注不在底部 `CommentSection`；评论仅在文末
- [x] 桌面：TOC **左侧**、边注 **右侧**；**默认均为收起细轨**
- [x] 0 条边注无空轨；点高亮自动展开右边注并定位
- [x] TOC/边注展开偏好 `localStorage` 可记忆
- [x] 窄屏 FAB + Sheet；letter/message 能力正确
- [x] `npm run web:build` 通过

---

## 相关文档

- [DESIGN.md](../../DESIGN.md) · [ARCHITECTURE.md](../ARCHITECTURE.md) · [ROADMAP.md](../../ROADMAP.md)
