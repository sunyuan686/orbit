# Orbit 已知 Bug 清单

> 记录已确认、尚未修复的问题。排障流程见 [DEBUGGING.md](./DEBUGGING.md)，功能进度见 [ROADMAP.md](../ROADMAP.md)。
>
> 最后更新：2026-06-26

---

## 状态说明

| 标记 | 含义 |
|------|------|
| 🔴 未修复 | 已复现，待排期 |
| 🟡 部分修复 | 有 workaround 或仅部分场景仍复现 |
| 🟢 已修复 | 已合并 main，保留记录供回归参考 |

---

## Bug #1：阅读页非编辑状态仍可输入字符，但无法换行

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-06-26 |
| 修复日期 | 2026-06-26 |
| 影响范围 | 阅读页（`ArticleView`），开启 inline 边注能力的内容类型 |
| 相关文件 | `web/src/components/TiptapEditor.tsx`、`web/src/extensions/ReadonlyGuard.ts` |

### 现象

- 在阅读页点击正文进入焦点后，**可以键入普通字符**（文字会出现在编辑器中）
- **按 Enter 无法换行**（换行被拦截）
- 用户感知为「半可编辑」状态，体验混乱

### 期望行为

- 非编辑（`readonly`）状态下，正文**完全不可输入**，包括字符、换行、删除、粘贴等
- 仍应保留：鼠标选中文字、复制（⌘C / Ctrl+C）、点击已有边注高亮

### 疑似根因

阅读页为支持边注选区，采用了「`editable: true` + 键盘拦截」的折中方案：

```typescript
// TiptapEditor.tsx
editable: !readonly || enableInlineComments,
```

当 `readonly=true` 且 `enableInlineComments=true` 时，ProseMirror 编辑器仍处于 **可编辑** 状态。输入限制仅依赖 `editorProps.handleKeyDown`：

- `Enter` / `Backspace` / `Delete` → `return true`（已拦截）
- 单字符按键 → 理论上 `return true`，但 **未覆盖所有输入路径**

可能漏网的输入通道：

1. `beforeinput` 事件（现代浏览器字符输入主路径，`handleKeyDown` 无法拦截）
2. IME 组合输入（`compositionstart` / `compositionend`）
3. 拖拽文本入编辑器（`handleDrop` 在 readonly 时已拦截，但文本类拖放可能走其他路径）

因此表现为：**换行被拦住，普通字符仍能插入**。

### 复现步骤

1. 登录后打开一篇支持边注的文章（如日记），URL 为 `/:type/:id`（非 `/edit`）
2. 点击正文任意段落，确保编辑器获得焦点
3. 直接键盘输入字母或汉字 → 字符出现在正文中
4. 按 Enter → 无换行（符合拦截逻辑，但与步骤 3 矛盾）

### 修复记录（2026-06-26）

采用方案 B（分离选区与编辑）：

- 阅读页 `editable: false`，由 DOM `contenteditable="false"` 从底层禁止输入
- 新增 `ReadonlyGuard` 扩展：`filterTransaction` 拦截用户文档变更，仅放行选区更新与带 `orbitAllowDocChange` meta 的程序化更新（边注高亮 mark）
- 移除 `handleKeyDown` / `handlePaste` / `handleDrop` 的 readonly 键盘拦截补丁
- readonly 时设置 `tabindex="0"`，保证聚焦与文字选区正常

验证：阅读页键入字符/换行/删除均不改变正文；拖选文字后「添加边注」按钮仍正常出现。

参考：[DEBUGGING.md §5.3](./DEBUGGING.md#53-阅读页编辑器)、[DEBUGGING.md §6](./DEBUGGING.md#6-tiptap--prosemirror-常见陷阱) 第 1 条。

---

## Bug #2：点击部分边注标注的正文内容不高亮

| 字段 | 内容 |
|------|------|
| 状态 | 🔴 未修复 |
| 发现日期 | 2026-06-26 |
| 影响范围 | 阅读页 inline 边注交互 |
| 相关文件 | `web/src/components/TiptapEditor.tsx`、`web/src/lib/anchor.ts`、`web/src/extensions/CommentHighlight.ts`、`web/src/index.css` |

### 现象

- 点击右侧边注卡片，对应正文会滚动定位，边注卡片进入 `active` 状态
- 但点击正文中**部分**已有边注标注的文字时：
  - 正文高亮样式（`orbit-comment-highlight--active`）**不出现**，或
  - 点击无反应，右侧边注栏未联动激活

### 期望行为

- 点击正文中任意一处边注标注（`mark[data-comment-id]`），应：
  1. 激活该边注（`activeInlineCommentId` 更新）
  2. 正文标注区域显示高亮底色（`.orbit-comment-highlight--active`）
  3. 右侧边注栏对应卡片同步 `active` 并滚动到可视区域

### 疑似根因

可能由以下一种或多种原因叠加导致：

#### 2.1 锚点定位失败，正文无 mark 元素

`resolveCommentPosition()` 无法定位时，边注仅在右侧面板展示（quote 兜底），正文**不会渲染** `<mark data-comment-id>`：

```typescript
// TiptapEditor.tsx — 定位失败则跳过 addMark
if (!resolved) {
  orphanCount++;
  continue;
}
```

此时正文无可点击的标注元素，自然无法高亮。Console 可能出现 `[anchor] … 孤儿` 统计。

#### 2.2 点击事件未命中 mark DOM

`handleClick` 依赖 `event.target.closest("[data-comment-id]")`：

```typescript
const mark = target?.closest?.("[data-comment-id]") as HTMLElement | null;
```

以下情况会失效：

- 点击落在 mark 的**边界缝隙**或子节点（如 mark 内嵌套 `<strong>` 等，部分浏览器事件 target 不在 mark 上）
- mark 跨节点断裂（`box-decoration-break` 视觉连续但 DOM 不连续）
- 高亮 mark 被后续 `dispatch` 覆盖或移除

#### 2.3 高亮 class 同步时机

`orbit-comment-highlight--active` 通过 `useEffect` + `querySelectorAll` 批量 toggle：

```typescript
editorRoot.querySelectorAll(".orbit-comment-highlight").forEach((node) => {
  element.classList.toggle("orbit-comment-highlight--active", isActive);
});
```

若边注 mark 的 `useEffect`（`addMark` dispatch）与高亮 class 的 `useEffect` 执行顺序交错，可能出现短暂或持续的不同步。`shouldRerenderOnTransaction: false`（readonly）会加剧 DOM 与 state 脱节风险。

#### 2.4 重复 quote 消歧失败

同一引文出现多次时，`anchor.ts` 依赖 `anchorPrefix` / `anchorSuffix` 消歧；消歧失败则 fallback 到第一个匹配，导致 mark 标在**错误位置**，用户点击真实标注文字时无 `data-comment-id`。

### 复现步骤

1. 打开一篇含多条 inline 边注的文章（边注越多越容易复现）
2. 观察正文：部分边注引文是否有下划线标注（`orbit-comment-highlight`）
3. 对有下划线的标注点击 → 确认是否出现底色高亮 + 右侧卡片激活
4. 对**无下划线**但右侧卡片有 quote 的边注：点击对应正文文字 → 预期无反应（锚点失效）
5. 打开 DevTools Console，过滤 `[anchor]` 查看孤儿 / 文本搜索统计

### 排查命令

```bash
# 查看某篇文章的边注锚点数据
sqlite3 data/orbit.db \
  "SELECT id, quote, anchor_from, anchor_to, anchor_prefix, anchor_suffix \
   FROM comment WHERE target_id='<entry_id>' AND kind='inline';"
```

```javascript
// 浏览器 Console：检查正文中的边注 mark 数量
document.querySelectorAll('.orbit-comment-highlight').length

// 检查某条边注是否有对应 DOM
document.querySelector('[data-comment-id="<comment_id>"]')
```

### 修复方向（建议）

| 方案 | 说明 |
|------|------|
| A. 扩大点击命中区域 | `handleClick` 改用 `editor.view.posAtCoords` + `doc.resolve(pos).marks()` 查找 `commentHighlight`，而非依赖 DOM `closest` |
| B. 锚点失效可视化 | 孤儿边注在面板标记「原文已变更」，避免用户误以为可点击正文 |
| C. 高亮与 mark 统一 | 将 `active` 状态写入 mark 的 `renderHTML` / `toDOM`，而非事后 querySelector 打 class |
| D. 消歧增强 | 存储更多上下文（段落 index、XPath）降低重复 quote 误匹配 |

---

## 相关文档

- [DEBUGGING.md](./DEBUGGING.md) — 排障案例与 TipTap 陷阱
- [marginalia-layout.md](./specs/marginalia-layout.md) — 边注交互设计
- [ROADMAP.md](../ROADMAP.md) — 功能进度与排期

---

*维护说明：Bug 修复合并后，请将对应条目状态改为 🟢，并在 CHANGELOG 中记录；勿删除历史条目，便于回归测试。*
