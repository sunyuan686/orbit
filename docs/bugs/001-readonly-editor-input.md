# Bug #1：阅读页非编辑状态仍可输入字符，但无法换行

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-06-26 |
| 修复日期 | 2026-06-26 |
| 影响范围 | 阅读页（`ArticleView`），开启 inline 边注能力的内容类型 |
| 相关文件 | `web/src/components/TiptapEditor.tsx`、`web/src/extensions/ReadonlyGuard.ts` |

## 现象

- 在阅读页点击正文进入焦点后，**可以键入普通字符**（文字会出现在编辑器中）
- **按 Enter 无法换行**（换行被拦截）
- 用户感知为「半可编辑」状态，体验混乱

## 期望行为

- 非编辑（`readonly`）状态下，正文**完全不可输入**，包括字符、换行、删除、粘贴等
- 仍应保留：鼠标选中文字、复制（⌘C / Ctrl+C）、点击已有边注高亮

## 疑似根因

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

## 复现步骤

1. 登录后打开一篇支持边注的文章（如日记），URL 为 `/:type/:id`（非 `/edit`）
2. 点击正文任意段落，确保编辑器获得焦点
3. 直接键盘输入字母或汉字 → 字符出现在正文中
4. 按 Enter → 无换行（符合拦截逻辑，但与步骤 3 矛盾）

## 修复记录（2026-06-26）

采用方案 B（分离选区与编辑）：

- 阅读页 `editable: false`，由 DOM `contenteditable="false"` 从底层禁止输入
- 新增 `ReadonlyGuard` 扩展：`filterTransaction` 拦截用户文档变更，仅放行选区更新与带 `orbitAllowDocChange` meta 的程序化更新（边注高亮 mark）
- 移除 `handleKeyDown` / `handlePaste` / `handleDrop` 的 readonly 键盘拦截补丁
- readonly 时设置 `tabindex="0"`，保证聚焦与文字选区正常

验证：阅读页键入字符/换行/删除均不改变正文；拖选文字后「添加边注」按钮仍正常出现。

参考：[DEBUGGING.md §5.3](../DEBUGGING.md#53-阅读页编辑器)、[DEBUGGING.md §6](../DEBUGGING.md#6-tiptap--prosemirror-常见陷阱) 第 1 条。
