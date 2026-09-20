# 051 — 操作确认弹窗回弹克制化与气泡几何锚点治理

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: HIGH
- **Category**: 3. Physicality & origin / 7. Cohesion & tokens
- **Estimated scope**: 1 file (`web/src/index.css`)

## Problem

1. **操作确认弹窗夸张超调弹性与低起点缩放**：
   在 `web/src/index.css:15387-15400` 中：
   ```css
   /* web/src/index.css:15387-15400 — current */
   .orbit-action-sheet {
     animation: orbit-action-sheet-pop 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
   }

   @keyframes orbit-action-sheet-pop {
     from {
       transform: scale(0.88);
       opacity: 0;
     }
     to {
       transform: scale(1);
       opacity: 1;
     }
   }
   ```
   这里的 `cubic-bezier(0.34, 1.56, 0.64, 1)` 产生了超过 56% 的卡通式弹性超调（Bounce），且起始缩放为 `0.88`（剧烈突变）。而在同一项目中，标准确认框 `.orbit-confirm-panel`（行 8513）使用的是克制的 `var(--motion-ease-enter)` 和 `scale(0.98)`。同类弹窗在两个不同模块产生截然相反的视觉语言，破坏了 Orbit 的文学沉静感。

2. **浮动菜单与气泡丢失 `transform-origin`**：
   - 桌面端通知面板 `.orbit-notification-panel`（行 2675）：绝对定位在右上方铃铛按钮下方，缩放时未声明 `transform-origin`，默认从几何中心 `50% 50%` 缩放，与上方铃铛触发器产生空间脱节。
   - 输入栏 Alt 属性悬浮窗 `.orbit-compose-alt-popover`（行 14328）：位于按钮上方（`bottom: calc(100% + 8px); left: 0;`），默认也是从中心缩放，而非从下方触发按钮生长。
   - 工具提示气泡 `[data-tooltip]::after`（行 14544）：位于按钮上方，未声明 `transform-origin: bottom center`。

## Target

1. **统一操作确认弹窗风格**：
   重构 `.orbit-action-sheet` 的动画，使其与项目核心规范对齐：
   - 动画曲线调整为 `var(--motion-ease-enter, cubic-bezier(0.22, 1, 0.36, 1))`；
   - 起始缩放从 `scale(0.88)` 修正为克制的 `scale(0.97)`，位移 `translateY(4px)`；
   - 彻底移除 `1.56` 弹力超调。

2. **校准气泡几何变换锚点**：
   - `.orbit-notification-panel` 显式设置 `transform-origin: top right;`；
   - `.orbit-compose-alt-popover` 显式设置 `transform-origin: bottom left;`；
   - `[data-tooltip]::after` 显式设置 `transform-origin: bottom center;`。

```css
/* target: web/src/index.css */
.orbit-action-sheet {
  animation: orbit-action-sheet-pop var(--motion-slow) var(--motion-ease-enter);
}

@keyframes orbit-action-sheet-pop {
  from {
    transform: translateY(6px) scale(0.97);
    opacity: 0;
  }
  to {
    transform: translateY(0) scale(1);
    opacity: 1;
  }
}

@media (min-width: 768px) {
  .orbit-notification-panel {
    transform-origin: top right;
  }
}

.orbit-compose-alt-popover {
  transform-origin: bottom left;
}

.orbit-tooltip-pop {
  transform-origin: bottom center;
}
```

## Repo conventions to follow

- 参考 `AUDIT.md` 第 3 节「Physicality & origin」：弹窗与下拉菜单必须以其触发器（Trigger）为物理缩放原点（Trigger-anchored origin）。
- 模态弹窗（居中）允许保留居中原点，但缩放区间必须控制在 `0.96~1.0` 之间，严禁卡通超弹。

## Steps

1. 修改 `web/src/index.css:15387`，替换 `orbit-action-sheet-pop` 的贝塞尔曲线和起始关键帧值。
2. 在 `web/src/index.css:2664`（`.orbit-notification-panel`）中增加 `transform-origin: top right;`。
3. 在 `web/src/index.css:14328`（`.orbit-compose-alt-popover`）中增加 `transform-origin: bottom left;`。
4. 在 `web/src/index.css:14544`（`[data-tooltip]::after`）中增加 `transform-origin: bottom center;`。

## Boundaries

- 不修改弹窗和气泡的业务逻辑与 DOM 结构。
- 保证移动端全屏模式下的抽屉通知栏覆盖原点为底部（不冲突）。

## Verification

- **Mechanical**:
  - `npm run web:build` 构建零报错。
- **Feel check**:
  - 点击任何触发二次确认的按钮（如清空或删除），观察弹窗出现方式：应平稳、迅速地从近处展开并柔和落定，无任何回弹晃动；
  - 点击右上角铃铛，通知面板应宛如从铃铛图标处自然倾泻展开（Top Right 展开）；
  - 悬停快捷按钮查看 Tooltip，Tooltip 应从按钮上方自然微缩放弹出。
- **Done when**: 彻底消除超调弹跳，所有浮层与气泡展开物理锚点准确对应触发源。
