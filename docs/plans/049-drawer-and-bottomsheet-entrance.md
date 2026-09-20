# 049 — 修复抽屉与移动端底部面板入场动效失效

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: HIGH
- **Category**: 1. Purpose & frequency / 4. Interruptibility
- **Estimated scope**: 3 files (`web/src/components/layout/BottomSheet.tsx`, `web/src/components/UsMenuSheet.tsx`, `web/src/index.css`)

## Problem

在移动端和桌面端，点击打开底部抽屉（如快速记录、操作表、评论面板）或点击「我们」展开侧边栏抽屉时，面板**没有任何滑动入场动效，而是瞬间硬生生闪现出现（0ms 硬切）**。

排查根因：
组件代码中使用了 `tailwindcss-animate` 专属类：

```tsx
/* web/src/components/layout/BottomSheet.tsx:167 — current */
className="relative z-10 w-full max-w-lg mx-auto bg-[var(--color-surface)] rounded-t-2xl shadow-xl border-t border-[var(--color-border-light)] flex flex-col animate-in slide-in-from-bottom duration-250 ease-out"

/* web/src/components/UsMenuSheet.tsx:61 — current */
className="relative z-10 h-full bg-[var(--color-surface)] shadow-2xl flex flex-col justify-between animate-in slide-in-from-left duration-250 ease-out"
```

本项目基于 Tailwind CSS v4，未安装亦不应引入外部 `tailwindcss-animate` 插件（避免引入冗余 CSS 构建胶水）。由于 `animate-in`、`slide-in-from-bottom`、`slide-in-from-left` 均为无意义的幽灵类名，浏览器不解析任何关键帧，导致抽屉完全丢失滑入动画，严重破坏交互连贯性。

## Target

1. 在 `web/src/index.css` 中定义高性能、GPU 合成层驱动的抽屉入场关键帧：
   - `@keyframes orbit-sheet-slide-up`（从 `translateY(100%)` 到 `translateY(0)`）
   - `@keyframes orbit-drawer-slide-left`（从 `translateX(-100%)` 到 `translateX(0)`）
2. 在 `BottomSheet.tsx` 和 `UsMenuSheet.tsx` 中使用专用的 Orbit 语义化类名，彻底移除失效的 Tailwind 幽灵类。
3. 抽屉背景蒙层补充平滑的 `orbit-fade-in 0.2s ease-out`。

```css
/* target: web/src/index.css */
@keyframes orbit-sheet-slide-up {
  from {
    transform: translateY(100%);
  }
  to {
    transform: translateY(0);
  }
}

.orbit-bottom-sheet-panel {
  animation: orbit-sheet-slide-up 0.25s var(--motion-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
}

.orbit-us-menu-panel {
  animation: orbit-drawer-slide-in 0.25s var(--motion-ease-drawer, cubic-bezier(0.32, 0.72, 0, 1));
}

@media (prefers-reduced-motion: reduce) {
  .orbit-bottom-sheet-panel,
  .orbit-us-menu-panel {
    animation: none;
  }
}
```

## Repo conventions to follow

- 抽屉缓动遵循 `DESIGN.md` 与 `AUDIT.md` 的 iOS 经典曲线：`--motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1)`。
- 抽屉动画类统一在 `web/src/index.css` 中以 `.orbit-*` 命名空间维护。
- 参考已有抽屉关键帧规范（见 `web/src/index.css:2699`）。

## Steps

1. 在 `web/src/index.css` 中添加 `.orbit-bottom-sheet-panel` 和 `.orbit-us-menu-panel` 动画规则，并补充 `@media (prefers-reduced-motion: reduce)`。
2. 编辑 `web/src/components/layout/BottomSheet.tsx:167`，移除 `animate-in slide-in-from-bottom duration-250 ease-out`，加入 `orbit-bottom-sheet-panel`。
3. 编辑 `web/src/components/UsMenuSheet.tsx:61`，移除 `animate-in slide-in-from-left duration-250 ease-out`，加入 `orbit-us-menu-panel`。

## Boundaries

- 严禁安装外部 npm 动画包（如 `tailwindcss-animate`、`framer-motion`）。
- 不破坏 `BottomSheet.tsx` 中已有的拖拽跟手与手势滑动关闭逻辑（拖拽时 `animation` 必须不干扰 `transform`）。

## Verification

- **Mechanical**:
  - `npm run web:build` 正常打包。
  - 搜索全站代码，确认不存在 `animate-in`、`slide-in-from-bottom`、`slide-in-from-left`。
- **Feel check**:
  - 在移动端模拟器或手机浏览器中点击底部快捷记事或评论，面板应像原生 iOS Sheet 一样从屏幕底部平稳向上推入，耗时约 250ms。
  - 点击左上角头像展开「我们」侧边面板，面板应从左向右平滑滑出，无闪烁和掉帧。
- **Done when**: 底部与侧边抽屉展开时具有自然顺滑的滑入过渡，关闭与拖拽退出功能完好无损。
