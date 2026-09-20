# 054 — 杂志阅读体验连贯性增益（Missed Opportunities Reveal）

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: LOW
- **Category**: 8. Missed opportunities
- **Estimated scope**: 3 files (`web/src/components/PhotoLightbox.tsx`, `web/src/components/InlineMarginaliaPopover.tsx`, `web/src/index.css`)

## Problem

Orbit 的定位是「温润克制的双人文学刊物与记忆平台」，但在当前几个核心场景中存在**瞬间硬切（Teleportation）**，缺乏物理展开的连续感：

1. **相册大图展开（Photo Lightbox Reveal）**：
   在相册详情点击某张相片时，遮罩与大图面板瞬间突兀地砸在屏幕上（0ms 无过渡），关闭时亦是瞬间消失。
2. **文本选区写边注（Inline Marginalia Popover）**：
   在长篇日记/信件中选中某行文字添加边注时，边注输入框瞬移出现，没有从所选文本处微展出的空间关联性。
3. **桌面端下拉日期弹窗（DatePicker Desktop Popover）**：
   桌面端点击日历输入框，下拉日历没有任何微动效，瞬间硬切。

## Target

1. **大图相簿展开与收拢（Photo Lightbox Reveal）**：
   - 入场：全屏半透明遮罩进行 180ms 快速平滑淡入（`opacity: 0` → `1`）；大图面板从 `scale(0.96)` 微缩放过渡至 `scale(1)`，耗时 180ms，使用 `--motion-ease-enter`。
   - 保证退出时同样自然收拢。
2. **边注输入框自然生长（Inline Marginalia Bloom）**：
   - 边注输入框添加 120ms 极轻量的微淡入与位移（`translateY(4px) scale(0.97)` → `translateY(0) scale(1)`），原点为选区上方，营造文字边缝自然生出纸片的质感。
3. **桌面端日期面板微渐显（DatePicker Desktop Reveal）**：
   - 添加 140ms `opacity` + `translateY(-4px)` 微缓入，原点为 `top left`。

```css
/* target: web/src/index.css */
@keyframes orbit-lightbox-fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes orbit-lightbox-scale-in {
  from {
    opacity: 0;
    transform: scale(0.96);
  }
  to {
    opacity: 1;
    transform: scale(1);
  }
}

.orbit-gallery-lightbox {
  animation: orbit-lightbox-fade-in 180ms ease-out;
}

.orbit-gallery-lightbox-panel {
  animation: orbit-lightbox-scale-in 180ms var(--motion-ease-enter);
}

.orbit-inline-marginalia-popover {
  animation: orbit-popover-bloom 120ms var(--motion-ease-enter);
  transform-origin: bottom left;
}

@keyframes orbit-popover-bloom {
  from {
    opacity: 0;
    transform: translateY(4px) scale(0.97);
  }
  to {
    opacity: 1;
    transform: translateY(0) scale(1);
  }
}

.orbit-date-picker-popover {
  animation: orbit-date-picker-pop 140ms var(--motion-ease);
  transform-origin: top left;
}

@keyframes orbit-date-picker-pop {
  from {
    opacity: 0;
    transform: translateY(-4px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
```

## Repo conventions to follow

- 严控动效时长在 120ms~180ms 极快区间内，不得阻碍用户操作或产生拖沓感。
- 绝不引入装饰性粒子、物理旋转或彩色光晕，纯以透明度与微缩放体现纸张秩序感。

## Steps

1. 在 `web/src/index.css` 中为 `.orbit-gallery-lightbox` 与 `.orbit-gallery-lightbox-panel` 添加 `animation` 与 `@keyframes`。
2. 为 `.orbit-inline-marginalia-popover` 添加 `orbit-popover-bloom` 关键帧。
3. 为桌面端 `.orbit-date-picker-popover` 添加 `orbit-date-picker-pop` 关键帧。
4. 确保在 `@media (prefers-reduced-motion: reduce)` 中关闭上述位移变换。

## Boundaries

- 不增加额外 DOM 节点或状态包装。
- 保证相册大图左右切图时不重复触发整屏的 `scale-in`（仅在外层模态首次打开时触发）。

## Verification

- **Mechanical**:
  - `npm run web:build` 构建通过。
- **Feel check**:
  - 点击照片缩略图：全屏大图如相纸般自然顺畅展开，不再有突兀的眼部闪烁冲击；
  - 选中一段文字写边注：输入条像便签纸一样从光标处轻巧出现；
  - 桌面端点选日期：日历浮层平稳落定。
- **Done when**: 页面核心留白与交互接缝处彻底告别生硬瞬移，呈现细腻刊物级润滑度。
