# 052 — 布局属性重排消除与 transition-all 范围收敛

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: HIGH
- **Category**: 5. Performance
- **Estimated scope**: 4 files (`web/src/index.css`, `web/src/components/moment/MomentQuickComposer.tsx`, `web/src/components/layout/TabBar.tsx`, `web/src/components/layout/QuickComposeSheet.tsx`)

## Problem

1. **过渡布局几何属性触发主线程重排（Layout Reflow）**：
   - 在 `web/src/index.css:11197-11204` 中，AI 悬浮球贴墙收缩（Docked）状态过渡了 `right` 属性：
     ```css
     /* web/src/index.css:11197-11204 — current */
     transition:
       transform 0.35s cubic-bezier(0.16, 1, 0.3, 1),
       opacity 0.3s ease,
       right 0.35s cubic-bezier(0.16, 1, 0.3, 1), /* ❌ 布局属性每帧触发 Reflow */
       box-shadow 0.3s ease,
       background var(--motion-fast),
       border-color var(--motion-fast);
     ```
     `right: -22px` 的过渡耗时长达 350ms，迫使浏览器在每一帧重新计算布局与渲染树，尤其在移动端会引起明显的掉帧与功耗发热。
   - 在 `web/src/components/moment/MomentQuickComposer.tsx:143` 中，文本输入框声明了 `transition-[height] duration-150`。当用户在多行输入打字触发内容自动撑高时，动画过渡高度会导致光标跳动与输入卡顿感。

2. **滥用无界 `transition: all` / `transition-all`**：
   - 在 `web/src/index.css`（如输入框行 671、Toggle 行 767、设置项行 3272 等）以及 `TabBar.tsx:55`、`QuickComposeSheet.tsx:329` 中，高频交互元素大量使用了 `transition: all`。
   - `transition: all` 是 Emil Kowalski 动效规范中的明确红线（Aggressive Escalation Trigger），会导致元素的 padding、border-width、outline、filter、box-sizing 等非预期属性参与不必要的计算。

## Target

1. **AI 悬浮球贴墙改由 GPU 合成层驱动**：
   - 移除 `right` 过渡属性；保持 `right` 位置恒定；
   - 贴墙收缩（`docked`）状态改为纯 `transform: translateX(22px)` 驱动。
2. **移除打字输入框的高度动画**：
   - 删除 `MomentQuickComposer.tsx` 中的 `transition-[height]`，使输入框自然贴合文字流。
3. **收敛 `transition: all` 为具体离散属性**：
   - 明确声明只对需要的视觉属性过渡（如 `background-color`, `border-color`, `color`, `box-shadow`, `transform`）。

```css
/* target: web/src/index.css:11197 */
.orbit-ai-fab {
  transition:
    transform var(--motion-slow) var(--motion-ease),
    opacity var(--motion-normal) ease,
    box-shadow var(--motion-normal) ease,
    background-color var(--motion-fast) ease,
    border-color var(--motion-fast) ease;
}

.orbit-ai-fab.orbit-ai-fab--docked:not(.orbit-ai-fab--hidden) {
  transform: translateX(22px);
  opacity: 0.6;
}

/* target: web/src/index.css:671 (.orbit-ui-input) */
.orbit-ui-input {
  transition:
    border-color var(--motion-fast) ease,
    box-shadow var(--motion-fast) ease,
    background-color var(--motion-fast) ease;
}

/* target: web/src/index.css:767 (.orbit-ui-toggle) */
.orbit-ui-toggle {
  transition:
    background-color var(--motion-fast) ease,
    border-color var(--motion-fast) ease;
}
```

## Repo conventions to follow

- 遵循 `STANDARDS.md` 第 7 节：仅动画 `transform` 与 `opacity`。
- 参考之前已完成的性能方案 `docs/plans/045-motion-performance-optimization.md` 中的合成层优化原则。

## Steps

1. 修改 `web/src/index.css:11197-11210`：
   - 从过渡列表中删除 `right`；
   - 将 `.orbit-ai-fab--docked` 的 `right: -22px` 改为 `transform: translateX(22px)`。
2. 修改 `web/src/components/moment/MomentQuickComposer.tsx:143`：
   - 移除 `transition-[height]` 与 `duration-150` 类名。
3. 修改 `web/src/index.css:671`（`.orbit-ui-input`）、`767`（`.orbit-ui-toggle`）、`2931`、`3272`（`.orbit-settings-nav-item`）：
   - 将 `transition: all ...` 替换为具体的属性过渡列表。
4. 修改 `web/src/components/layout/TabBar.tsx:55` 与 `QuickComposeSheet.tsx:329`：
   - 将 `transition-all` 替换为 `transition-[transform,background-color,box-shadow]`。

## Boundaries

- 保证 AI 悬浮球贴墙半隐藏的视觉位置（露出半圆手柄）像素对齐不变。
- 保证输入框 focus 时的发光边框正常过渡。

## Verification

- **Mechanical**:
  - `npm run web:build` 构建通过。
  - `npm test` 单元测试通过。
- **Feel check**:
  - 触发 AI 悬浮球贴墙收缩与点开：在 Chrome DevTools Performance 面板录制，确认无 Layout / Reflow 红色警告，仅产生 Composite Layers；
  - 在快速记录中长文打字换行：确认多行输入框随输入即刻撑开，打字光标无抖动与滞后延迟。
- **Done when**: 全站核心高频交互不再有布局属性重排与无界 `transition: all`。
