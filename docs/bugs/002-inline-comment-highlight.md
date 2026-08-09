# Bug #2：点击部分边注标注的正文内容不高亮

| 字段 | 内容 |
|------|------|
| 状态 | 🔴 未修复 |
| 发现日期 | 2026-06-26 |
| 影响范围 | 阅读页 inline 边注交互 |
| 相关文件 | `web/src/components/TiptapEditor.tsx`、`web/src/lib/anchor.ts`、`web/src/extensions/CommentHighlight.ts`、`web/src/index.css` |

## 现象

- 点击右侧边注卡片，对应正文会滚动定位，边注卡片进入 `active` 状态
- 但点击正文中**部分**已有边注标注的文字时：
  - 正文高亮样式（`orbit-comment-highlight--active`）**不出现**，或
  - 点击无反应，右侧边注栏未联动激活

## 期望行为

- 点击正文中任意一处边注标注（`mark[data-comment-id]`），应：
  1. 激活该边注（`activeInlineCommentId` 更新）
  2. 正文标注区域显示高亮底色（`.orbit-comment-highlight--active`）
  3. 右侧边注栏对应卡片同步 `active` 并滚动到可视区域

## 疑似根因

可能由以下一种或多种原因叠加导致：

### 锚点定位失败，正文无 mark 元素

`resolveCommentPosition()` 无法定位时，边注仅在右侧面板展示（quote 兜底），正文**不会渲染** `<mark data-comment-id>`：

```typescript
// TiptapEditor.tsx — 定位失败则跳过 addMark
if (!resolved) {
  orphanCount++;
  continue;
}
```

此时正文无可点击的标注元素，自然无法高亮。Console 可能出现 `[anchor] … 孤儿` 统计。

### 点击事件未命中 mark DOM

`handleClick` 依赖 `event.target.closest("[data-comment-id]")`：

```typescript
const mark = target?.closest?.("[data-comment-id]") as HTMLElement | null;
```

以下情况会失效：

- 点击落在 mark 的**边界缝隙**或子节点（如 mark 内嵌套 `<strong>` 等，部分浏览器事件 target 不在 mark 上）
- mark 跨节点断裂（`box-decoration-break` 视觉连续但 DOM 不连续）
- 高亮 mark 被后续 `dispatch` 覆盖或移除

### 高亮 class 同步时机

`orbit-comment-highlight--active` 通过 `useEffect` + `querySelectorAll` 批量 toggle：

```typescript
editorRoot.querySelectorAll(".orbit-comment-highlight").forEach((node) => {
  element.classList.toggle("orbit-comment-highlight--active", isActive);
});
```

若边注 mark 的 `useEffect`（`addMark` dispatch）与高亮 class 的 `useEffect` 执行顺序交错，可能出现短暂或持续的不同步。`shouldRerenderOnTransaction: false`（readonly）会加剧 DOM 与 state 脱节风险。

### 重复 quote 消歧失败

同一引文出现多次时，`anchor.ts` 依赖 `anchorPrefix` / `anchorSuffix` 消歧；消歧失败则 fallback 到第一个匹配，导致 mark 标在**错误位置**，用户点击真实标注文字时无 `data-comment-id`。

## 复现步骤

1. 打开一篇含多条 inline 边注的文章（边注越多越容易复现）
2. 观察正文：部分边注引文是否有下划线标注（`orbit-comment-highlight`）
3. 对有下划线的标注点击 → 确认是否出现底色高亮 + 右侧卡片激活
4. 对**无下划线**但右侧卡片有 quote 的边注：点击对应正文文字 → 预期无反应（锚点失效）
5. 打开 DevTools Console，过滤 `[anchor]` 查看孤儿 / 文本搜索统计

## 排查命令

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

## 修复方向（建议）

| 方案 | 说明 |
|------|------|
| A. 扩大点击命中区域 | `handleClick` 改用 `editor.view.posAtCoords` + `doc.resolve(pos).marks()` 查找 `commentHighlight`，而非依赖 DOM `closest` |
| B. 锚点失效可视化 | 孤儿边注在面板标记「原文已变更」，避免用户误以为可点击正文 |
| C. 高亮与 mark 统一 | 将 `active` 状态写入 mark 的 `renderHTML` / `toDOM`，而非事后 querySelector 打 class |
| D. 消歧增强 | 存储更多上下文（段落 index、XPath）降低重复 quote 误匹配 |
