# 048 — 动效 Token 规范化与全局缓动收敛

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: MEDIUM
- **Category**: 7. Cohesion & tokens
- **Estimated scope**: 1 file (`web/src/index.css`)

## Problem

全局动效 Token 与业务代码严重割裂。
在 `web/src/index.css:165` 中，默认 `--motion-ease` 声明了带有 `1.1` 超调弹性（Overshoot）的曲线：

```css
/* web/src/index.css:165 — current */
--motion-ease: cubic-bezier(0.175, 0.885, 0.32, 1.1);
--motion-ease-enter: cubic-bezier(0.22, 1, 0.36, 1);
--motion-ease-move: cubic-bezier(0.25, 1, 0.5, 1);
--motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);
```

因为 `--motion-ease` 存在卡通式弹性超调，与 Orbit 刊物文学、克制通透的排版哲学冲突，导致工程中开发者在 15 处业务样式和组件（如通知面板、日期选择器、大图遮罩、刮刮卡等）中只能绕过全局 Token，反复手写硬编码字符串 `cubic-bezier(0.16, 1, 0.3, 1)`。这直接违背了 `DESIGN.md` 中「严禁硬编码，一律使用 CSS Variables Token 驱动」的铁律。

## Target

1. 在 `:root` 中将全局 `--motion-ease` 收敛为经过大量实践检验的高响应度标准减速曲线（Ease-out）：
   `--motion-ease: cubic-bezier(0.16, 1, 0.3, 1);`
2. 保留 `--motion-ease-enter`、`--motion-ease-move`、`--motion-ease-drawer`，并提供语义清晰的单点真源。
3. 将全站散落的 `cubic-bezier(0.16, 1, 0.3, 1)` 统一重构替换为 `var(--motion-ease)`。

```css
/* web/src/index.css:161-170 — target */
  /* Motion Tokens */
  --motion-fast: 120ms;
  --motion-normal: 150ms;
  --motion-slow: 220ms;
  --motion-ease: cubic-bezier(0.16, 1, 0.3, 1);        /* 核心高质感减速曲线 */
  --motion-ease-enter: cubic-bezier(0.22, 1, 0.36, 1); /* 入场微扩展 */
  --motion-ease-move: cubic-bezier(0.25, 1, 0.5, 1);   /* 位移与视差 */
  --motion-ease-drawer: cubic-bezier(0.32, 0.72, 0, 1);/* 抽屉与大面板 */
  --motion-press-scale: 0.96;
```

## Repo conventions to follow

- 所有全局动效 Tokens 统一放置在 `web/src/index.css` 的 `:root` 块中（行 161~170）。
- 参见 `DESIGN.md` 第 108 行关于动效与设计 Token 的集中规范。

## Steps

1. 修改 `web/src/index.css:165`，将 `--motion-ease` 的值从 `cubic-bezier(0.175, 0.885, 0.32, 1.1)` 更改为 `cubic-bezier(0.16, 1, 0.3, 1)`。
2. 检索并替换 `web/src/index.css` 中所有硬编码的 `cubic-bezier(0.16, 1, 0.3, 1)` 为 `var(--motion-ease)`：
   - 行 1043 (`.orbit-infotip-popover`)
   - 行 2675 (`.orbit-notification-panel`)
   - 行 7139 (`.orbit-date-picker-popover`)
   - 行 7636 (`.orbit-gallery-item-anim`)
   - 行 8404-8405 (`.orbit-toast`)
   - 行 11493 (`.orbit-gallery-lightbox-controls`)
   - 行 12192 (`.orbit-scratch-modal-dialog`)
   - 行 14342 (`.orbit-compose-alt-popover`)
   - 行 14544 (`.orbit-tooltip-pop`)
   - 行 14611 (`.orbit-fade-in`)

## Boundaries

- 不得更改组件原有的持续时间（duration）数值。
- 不得在业务 TSX 中新增行内 style 注入贝塞尔曲线。

## Verification

- **Mechanical**:
  - `npm run typecheck` 零报错通过。
  - `npm run web:build` 构建打包通过。
- **Feel check**:
  - 触发通知面板展开、日期选择器弹出、Toast 提示显示，观察动效起始速度与停止阻尼感。
  - 在 Chrome DevTools 打开 Animations 面板，以 10% 速度回放，确认没有弹跳（Overshoot）或抖动，自然减速吸附落定。
- **Done when**: 全局 CSS 中不再存在裸写 `cubic-bezier(0.16, 1, 0.3, 1)`，全部由 `var(--motion-ease)` 统一驱动。
