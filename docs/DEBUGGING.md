# Orbit 前端排障指南

> 记录真实踩坑案例与可复用的排查流程。目标：白屏、单篇内容打不开等问题能在 **5 分钟内定位到模块**，而不是靠猜。

---

## 1. 当前可观测性（现状）

| 能力 | 状态 | 说明 |
|------|------|------|
| 路由 `ErrorBoundary` | ✅ 有 | `RouteErrorBoundary` 包住 `<Outlet />`，见 `web/src/components/RouteErrorBoundary.tsx` |
| `window.onerror` / `unhandledrejection` | ✅ DEV | `main.tsx` 开发环境输出 `[global]` 前缀 |
| 结构化前端日志 | ❌ 无 | 见 [ROADMAP.md](./ROADMAP.md#可观测性与日志) |
| 审计日志（持久化） | ❌ 无 | 见 ROADMAP，当前仅 `console.info` |
| TipTap / 边注锚定 | ⚠️ 部分 | `TiptapEditor` / `ArticleEdit` 在失败时用 `console.warn('[anchor] …')` |
| 边注起草浮层 | ⚠️ 部分 | 定位失败时 `console.warn('[marginalia] …')` |
| 后端请求日志 | ⚠️ 默认 Hono | 开发时看终端 `[server]` 输出 |
| SQLite 直查 | ✅ 有 | 本地 `data/orbit.db`，适合查单条 entry / comment |

**结论**：路由级崩溃已有错误页；**结构化日志与审计表仍待做**。边注 / 锚定问题靠 Console `[anchor]` + 本文清单排查。

---

## 2. 案例：单篇日记白屏（2026-06）

### 现象

- 列表页正常，点击《测试新建日记》→ **整页空白**
- 其他日记可打开
- 页面 `<title>` 有时已变成文章标题，说明 `ArticleView` 已开始加载，**崩溃发生在渲染/副作用阶段**

### 数据特征（事后 SQLite 确认）

```bash
sqlite3 data/orbit.db \
  "SELECT id, title FROM entry WHERE id='ent_84d7pkvs7v';"

sqlite3 data/orbit.db \
  "SELECT id, kind, quote, anchor_from, anchor_to FROM comment WHERE target_id='ent_84d7pkvs7v' AND kind='inline';"
```

该篇 **8 条 inline 边注**（全库少有的高密度）；其余日记多为 0 条边注。

### 根因

`web/src/components/TiptapEditor.tsx` 边注高亮 `useEffect` 中：

```typescript
// ❌ 错误：tr 已改 doc，selection 仍指向旧 doc
const selection = editor.state.selection;
editor.view.dispatch(tr.setSelection(selection));
```

ProseMirror 校验 `selection` 与 `tr.doc` 不一致时 **抛异常**。异常发生在 `useEffect` 里且未被捕获 → React 子树卸载 → 白屏。

无 inline 边注时 `tr.docChanged === false`，不会 dispatch，故其他文章正常。

### 修复要点

```typescript
// ✅ 让 ProseMirror 自动映射选区
editor.view.dispatch(tr);

// ✅ 单条 mark / dispatch 包 try/catch，带统一前缀
console.warn("[anchor] Failed to apply inline highlight mark", comment.id, err);
```

同时：阅读页不再用 `getHTML()` 回写正文；`shouldRerenderOnTransaction: false`（readonly）。

### 为什么当时难排查

1. **无 ErrorBoundary** → 用户只见白屏，无「页面出错」提示  
2. **无全局错误钩子** → 不打开 Console 看不到堆栈  
3. **问题与数据相关** → 只有这篇有 8 条边注，容易误判为「路由/权限/单条脏数据」  
4. **异常在 useEffect** → 不一定触发 Vite 红屏 overlay（且 `#root` 可能已空）  
5. **当时尚无 `[anchor]` 日志** → 修复前 dispatch 失败完全静默  

---

## 3. 案例：选中文字点击「添加边注」没反应（2026-06）

### 现象

- 阅读页（`ArticleView`，**不是**编辑页）选中正文文字后，黑色浮动按钮「添加边注」正常出现
- 点击按钮后：**按钮消失，但看不到任何输入框**，用户感知为「完全没反应」
- 控制台通常**没有**红色 `Uncaught` 异常（与白屏案例不同）
- 复现数据：`ent_84d7pkvs7v`（《测试新建日记》），正文含「哈哈哈哈」等段落，且已有若干条 inline 边注

### 根因（UI 迁移断层 + 渲染时序）

边注布局重构（见 [MARGINALIA-LAYOUT.md](./MARGINALIA-LAYOUT.md)）后，起草流程发生变化：

| 阶段 | 旧行为 | 新行为 |
|------|--------|--------|
| 点击「添加边注」 | `setInlineDraft` + 滚动到底部 `CommentSection` 的 `.orbit-inline-draft textarea` | `setInlineDraft` + 在 `TiptapEditor` 内显示 `InlineMarginaliaPopover`（「写边注…」） |
| 输入位置 | 页面底部评论区 | 选中文字旁的浮动输入框 |

问题出在 `TiptapEditor.tsx` 的**渲染条件与坐标计算时序**：

```tsx
// ❌ 问题写法：三个条件同时满足才渲染浮层
{inlineDraft && draftPopover && onSubmitInlineComment && (
  <InlineMarginaliaPopover ... />
)}
```

点击按钮后的实际顺序：

1. `onCreateInlineComment` → 父组件 `ArticleView` 设置 `inlineDraft`
2. `setSelectionMenu(null)` → **黑色按钮立刻消失**（用户以为操作已结束）
3. `draftPopover` 坐标在 `useEffect` 里异步计算 → 首帧 `draftPopover === null`，浮层**不渲染**
4. 若坐标计算失败或被高亮 mark 的 `dispatch` 干扰，浮层可能长时间不出现 → **表现为「没反应」**

次要因素：

- 「添加边注」按钮原先只绑 `onMouseDown`，部分浏览器 / 触控场景下不如 `onClick` 稳定
- 旧代码依赖 `.orbit-inline-draft` 滚动反馈；该 DOM 已从 `CommentSection` 移除，中间态无任何可见反馈

### 修复要点

```tsx
// ✅ 有 inlineDraft 即渲染浮层；坐标用 useLayoutEffect 同步计算，避免首帧空白
useLayoutEffect(() => {
  updateDraftPopover();
}, [updateDraftPopover]);

// ✅ 不再要求 draftPopover 才挂载组件
{inlineDraft && onSubmitInlineComment && (
  <div style={draftPopover ? { top, left } : { visibility: "hidden" }}>
    <InlineMarginaliaPopover ... />
  </div>
)}

// ✅ 坐标计算用 editorRef.current（与 updateSelectionMenu 一致）
// ✅ 高亮 mark dispatch 后用 requestAnimationFrame 重新定位
// ✅ 按钮同时支持 onMouseDown（preventDefault 保选区）+ onClick，并防重复触发
// ✅ 创建起草时 setMarginaliaOpen(true)，右侧边注栏一并展开作视觉反馈
```

涉及文件：

- `web/src/components/TiptapEditor.tsx` — 选区按钮、浮层定位、起草 mark
- `web/src/pages/ArticleView.tsx` — `inlineDraft` 状态、`handleCreateInlineDraft`

### 为什么容易误判

1. **按钮消失 = 操作已生效的第一步**，但旧习惯是滚到底部找输入框 → 新 UI 在选中文字旁，容易忽略  
2. **无 Console 报错** → 不像白屏案例那样显眼，会怀疑点击事件没触发  
3. **编辑页无边注 UI**（`ArticleEdit` 未传 `enableInlineComments`）→ 在编辑页选文字不会出现按钮，与阅读页混淆  
4. **`message` 类型内容**不支持边注（`commentCapabilities`）→ 能力矩阵问题，不是 bug  

### 排查步骤（专用于「添加边注没反应」）

按顺序做，约 **3 分钟**可定性。

#### Step 1：确认页面与能力（30 秒）

| 检查项 | 期望 |
|--------|------|
| URL 为 `/:type/:id` 阅读页，非 `/edit` | 编辑页无边注起草 UI |
| 内容类型 | `diary` / `timeline` / `memo` / `letter` 支持 inline；`message` 不支持 |
| 已登录 | 未登录会跳登录页 |

```typescript
// 浏览器 Console
getCommentCapabilities("diary")  // 需在源码上下文；或直接看页面是否有边注侧栏/FAB
```

#### Step 2：确认选区按钮能出现（30 秒）

1. 用鼠标拖选正文（不要用 DevTools 强行 `window.getSelection()`，ProseMirror 内部选区可能不同步）
2. 黑色「添加边注」应出现在选区下方  
3. 若按钮不出现 → 查 [§6 TipTap 陷阱](#6-tiptap--prosemirror-常见陷阱) 第 1 条（`editable` / `selectionUpdate`）

#### Step 3：点击后查 DOM 状态（1 分钟）

点击「添加边注」后立刻在 Console 执行：

```javascript
({
  selectionBtn: !!document.querySelector(".orbit-selection-comment-btn"),
  popover: !!document.querySelector(".orbit-inline-marginalia-popover"),
  draftInput: document.querySelector(".orbit-inline-marginalia-popover-input"),
  draftMark: document.querySelector('[data-comment-id="__draft__"]'),
  anchor: document.querySelector(".orbit-inline-marginalia-popover-anchor")?.getAttribute("style"),
})
```

| 结果 | 含义 | 下一步 |
|------|------|--------|
| `selectionBtn: true` | 点击未触发起草 | 查按钮事件、`onCreateInlineComment` 是否传入 |
| `selectionBtn: false`, `popover: false` | 起草状态可能未设置或被取消 | React DevTools 看 `ArticleView` 的 `inlineDraft` |
| `popover: true` | 浮层已渲染，可能在视口外或被遮挡 | 看 `anchor` 的 `top`/`left`，滚动正文区域 |
| `draftMark` 存在 | 起草高亮已打上，仅浮层不可见 | 查 `[marginalia]` warn、CSS `overflow` |

#### Step 4：Console 日志（30 秒）

过滤前缀：

- `[marginalia] Failed to position inline draft popover` — 坐标计算失败（`coordsAtPos` 异常）
- `[anchor] Failed to dispatch inline highlight marks` — 高亮 mark 未应用，可能影响定位
- `[anchor] Failed to apply draft highlight mark` — 起草 mark 单条失败

#### Step 5：查 React 状态（可选）

React DevTools → `ArticleView`：

- `inlineDraft` 应为 `{ quote, anchorFrom, anchorTo, ... }` 非 `null`
- `TiptapEditor` props：`enableInlineComments={true}`、`onSubmitInlineComment` 已传

`inlineDraft` 有值但无浮层 → 定位逻辑问题（本节根因）。  
`inlineDraft` 为 `null` → 点击未触发或随即被 `onCancelInlineDraft` 取消（点击了编辑器外区域）。

#### Step 6：区分两种「添加边注」按钮

| UI | 类名 / 位置 | 作用 |
|----|-------------|------|
| 选区浮动按钮（黑底白字） | `.orbit-selection-comment-btn` | 从选中文字**创建起草** |
| 浮层内提交按钮（圆形箭头） | `.orbit-inline-marginalia-popover-submit`，`aria-label="添加边注"` | **提交**已输入的边注正文 |

浮层提交按钮在输入为空时 `disabled`，也会被描述为「没反应」——需先输入文字。

### 正确交互（修复后）

1. 阅读页选中文字 → 出现黑色「添加边注」
2. 点击 → 选区旁出现「写边注…」输入框，选中文字带琥珀色下划线，右侧边注栏展开
3. 输入内容 → 点击箭头或 Enter 提交
4. Esc 或点击编辑器外空白取消起草

---

## 4. 白屏 / 单页打不开的排查清单

按顺序做，不要跳步。

### Step 1：确认范围（30 秒）

| 问题 | 含义 |
|------|------|
| 只有一篇文章？ | 优先查 **该篇数据**（边注数、正文 HTML、异常字段） |
| 所有文章？ | 优先查 **最近改动的公共组件**（Layout、TiptapEditor、鉴权） |
| `#root` 是否为空？ | `document.getElementById('root')?.childElementCount` → `0` 多为根级崩溃 |

### Step 2：浏览器 Console（1 分钟）

1. 打开 DevTools → **Console**，勾选 **Preserve log**  
2. 硬刷新问题 URL  
3. 找 `Uncaught`、`Maximum update depth`、`TextSelection` / `ProseMirror` 字样  

### Step 3：Network（1 分钟）

- `GET /api/entries/:id` → 200？  
- `GET /api/comments?...` → 200？评论是否特别多或字段异常？  

### Step 4：本地数据（2 分钟）

```bash
# 文章正文
sqlite3 data/orbit.db \
  "SELECT id, title, length(body), substr(body,1,200) FROM entry WHERE id='<ENTRY_ID>';"

# 边注 / 评论
sqlite3 data/orbit.db \
  "SELECT id, kind, quote, anchor_from, anchor_to, length(body) FROM comment WHERE target_id='<ENTRY_ID>';"

# 对比：其他能打开的文章 inline 数量
sqlite3 data/orbit.db \
  "SELECT e.id, e.title,
     (SELECT count(*) FROM comment c WHERE c.target_id=e.id AND c.kind='inline') AS inline_n
   FROM entry e WHERE e.type='diary' ORDER BY inline_n DESC LIMIT 5;"
```

### Step 5：缩小到组件

| 模块 | 文件 | 典型触发条件 |
|------|------|----------------|
| 阅读页组装 | `web/src/pages/ArticleView.tsx` | entry / comments 加载后 |
| 正文 + 边注 | `web/src/components/TiptapEditor.tsx` | **有 inline 边注**、选区、高亮 mark、**起草浮层** |
| 边注侧栏 | `web/src/components/MarginaliaRail.tsx` | 边注列表展开 |
| 锚定算法 | `web/src/lib/anchor.ts` | quote / anchorFrom / anchorTo 不匹配 |

### Step 6：未登录自动化时注意

Playwright / curl 未带 session 会跳登录页，**不是**白屏。Cursor 内置浏览器若已登录，才适合复现阅读页问题。

---

## 5. 推荐日志与防护规范

### 5.1 日志前缀（约定）

| 前缀 | 模块 |
|------|------|
| `[anchor]` | 边注锚定、ProseMirror mark、位置重算 |
| `[marginalia]` | 边注 UI 轨、起草、侧栏 |
| `[api]` | 可选：fetch 失败（已有 toast 时可不打） |

- 使用 **`console.warn`**：可恢复、已降级（单条边注未高亮）  
- 使用 **`console.error`**：不应发生、影响主流程  
- 日志文案用 **英文**（与代码注释一致）  

### 5.2 副作用里调用 ProseMirror / TipTap

```typescript
useEffect(() => {
  if (!editor || editor.isDestroyed) return;

  try {
    // build transaction…
    if (tr.docChanged) {
      editor.view.dispatch(tr);
    }
  } catch (err) {
    console.warn("[anchor] Failed to apply highlight marks", err);
  }
}, [editor, /* 稳定 deps */]);
```

**禁止**：在已修改的 `tr` 上 `setSelection(editor.state.selection)`（旧 doc 的选区）。

### 5.3 阅读页编辑器

- `readonly` 时 **不要** 用 `getHTML() !== defaultValue` 触发 `setContent`（边注 mark 会改 HTML）  
- readonly + 边注能力：`editable: true` + 拦截输入，保证选区事件正常  
- 高成本 transaction：`shouldRerenderOnTransaction: false`（readonly）  

### 5.4 边注起草浮层（InlineMarginaliaPopover）

- 有 `inlineDraft` 就应挂载浮层，**不要**把 `draftPopover` 坐标作为渲染门闩  
- 坐标用 `useLayoutEffect` + `editorRef.current`，避免 `useEffect` 首帧空白  
- 高亮 mark `dispatch` 后用 `requestAnimationFrame` 重新 `updateDraftPopover`  
- 选区按钮：`onMouseDown` + `preventDefault`（保留选区）+ `onClick` 兜底；防重复触发  
- 创建起草时展开 `MarginaliaRail` / `MobileMarginalia`，给用户明确反馈  

### 5.5 建议补齐（待做）

| 项 | 优先级 | 说明 |
|----|--------|------|
| ~~`RouteErrorBoundary` 包住 `<Outlet />`~~ | ~~P0~~ | ✅ 已实现 |
| 前端 / 后端结构化日志 | P1 | 见 ROADMAP「可观测性与日志」 |
| 持久化 `audit_log` | P1 | 见 ROADMAP |
| 边注 mark 成功/失败计数 debug | P2 | 仅 `import.meta.env.DEV` |
| E2E：选区 → 添加边注 → 提交起草 | P2 | 覆盖 [§3](#3-案例选中文字点击添加边注没反应2026-06) 回归 |

---

## 6. TipTap / ProseMirror 常见陷阱

1. **`editable: false`**：浏览器能蓝选文字，但 `selectionUpdate` 可能不触发 → 边注按钮不出现  
2. **`dispatch` 后 `getHTML()` 变化**：阅读页若回写 `defaultValue` 会与高亮 mark 打架  
3. **重叠边注**：同一 quote 多条 comment 合法，但 mark 越多越容易暴露 dispatch  bug  
4. **锚点失效**：正文改过后面板仍显示（quote 兜底），高亮可能不上屏 → 看 `[anchor]` warn，不是白屏  
5. **起草浮层门闩**：`inlineDraft && draftPopover` 同时判断会导致首帧不渲染 → 见 [§3](#3-案例选中文字点击添加边注没反应2026-06)  
6. **DOM 选区 ≠ PM 选区**：Console 里 `window.getSelection()` 有文字，不代表 `selectionUpdate` 已触发  

---

## 7. 快速命令备忘

```bash
# 开发
npm run dev

# 构建（类型检查）
npm run web:build

# 查库
sqlite3 data/orbit.db ".tables"
sqlite3 data/orbit.db "SELECT id, title FROM entry ORDER BY updated_at DESC LIMIT 10;"
```

---

## 8. 相关文档

- [ARCHITECTURE.md](./ARCHITECTURE.md) — 目录与 API
- [ROADMAP.md](./ROADMAP.md) — **可观测性与日志**排期
- [MARGINALIA-LAYOUT.md](./MARGINALIA-LAYOUT.md) — 边注交互与组件  
- [CONTRIBUTING.md](./CONTRIBUTING.md) — 开发流程  

---

*最后更新：2026-06 · 案例来源：阅读页单篇白屏（`ent_84d7pkvs7v`，8 条 inline 边注触发 ProseMirror dispatch 异常）；选中文字点击「添加边注」无可见反馈（边注 UI 迁移后 `draftPopover` 渲染门闩 + 坐标异步计算）。*
