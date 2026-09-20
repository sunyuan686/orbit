# 050 — 相册大图与卡片叠放滑动手势反向跳动物理修复

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: HIGH
- **Category**: 3. Physicality & origin / 4. Interruptibility
- **Estimated scope**: 2 files (`web/src/components/PhotoLightbox.tsx`, `web/src/components/MultiImageDeck.tsx`)

## Problem

在移动端全屏照片大图（`PhotoLightbox.tsx`）和卡片叠放（`MultiImageDeck.tsx`）中，用户横向轻扫手势切换照片时，存在严重的「反向回弹 + 画面突变」物理反常：

以 `PhotoLightbox.tsx:154-175` 为例：

```ts
/* web/src/components/PhotoLightbox.tsx:154-175 — current */
if (panelRef.current) {
  panelRef.current.style.transition = "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)";
  panelRef.current.style.transform = ""; // ❌ 立即重置为居中！
}

const absX = Math.abs(deltaX);
const absY = Math.abs(deltaY);

// 下拉阻尼释放退出
if (deltaY > 80 && absY > absX * 1.2) {
  onClose();
  return;
}

// 横向滑动切换
if (absX > 45 || (absX > 20 && duration < 250)) {
  if (deltaX < 0) {
    handleNext(); // 触发 React 状态更新换图
  } else {
    handlePrev();
  }
}
```

现象：当用户将图片向左拖拽 100px 并松手时，用户的意图是将图片「向左划走」，但代码在松手时直接执行了 `panelRef.current.style.transform = ""`，导致图片先逆着用户手势「向右弹回中央」，随后 React 状态变更又把内容生硬闪现替换为下一张图片。用户肉眼感受到的是极其突兀的画面抽搐。同理，`MultiImageDeck.tsx:100-115` 也存在一模一样的反物理逻辑。

## Target

1. **顺势滑出（Fling-out exit）**：
   - 当水平滑动位移超过阈值（`absX > 45` 或速度满足快扫）且有下一张/上一张时，图片应继续顺着手势方向平滑滑出视口（例如 `translateX(-100vw)`），过渡耗时 180ms。
   - 滑出完成后切换图片数据，并在下一帧无缝从另一侧滑入或瞬间就位，彻底消除反向回弹感。
2. **手势未达阈值（Cancel rebound）**：
   - 仅在未达到切图阈值时，才执行原位回弹复位（Rebound to center `transform = ""`）。
3. **下拉退出同理（Pull-to-dismiss exit）**：
   - 下拉关闭时，顺势向下滑出屏幕（`translateY(100vh)`）后触发 `onClose()`。

## Repo conventions to follow

- 参考 `docs/guides/layout-debugging-methodology.md` 与 `docs/bugs/036-photo-lightbox-navigation-and-gestures.md`，组件遵循轻量高效的 DOM Ref 直接驱动模型，不在 `touchmove` 中高频 `setState`。
- 动效曲线采用统一的 `cubic-bezier(0.16, 1, 0.3, 1)`。

## Steps

1. 修改 `web/src/components/PhotoLightbox.tsx` 中的 `handleTouchEnd`：
   - 判断如果满足横向切换条件（如 `deltaX < -45` 且 `hasNext`）：
     - 将 `panelRef.current.style.transition` 设置为 `transform 180ms var(--motion-ease, cubic-bezier(0.16, 1, 0.3, 1))`；
     - 将 `panelRef.current.style.transform` 设定为顺势出屏位置 `translate3d(-100vw, 0, 0)`；
     - 使用 `setTimeout` (180ms) 触发 `handleNext()`，并在换图后瞬间重置 `style.transition = "none"` 与 `style.transform = ""`，准备迎接下一次交互。
   - 若未达阈值，才平滑弹回原点 `transform = ""`。
2. 对 `web/src/components/MultiImageDeck.tsx` 中的 `handleTouchEnd` 进行相同改造，确保向左/向右切卡片时，被划走的顶层卡片向屏幕外抛出后再切换，不反弹。

## Boundaries

- 保持双端兼容（桌面端点击左右箭头和键盘 `←`/`→` 切换不受影响）。
- 保持单张图片时的边界阻尼（无上一张/下一张时正常回弹）。

## Verification

- **Mechanical**:
  - `npm run typecheck` 零报错通过。
  - `npm test` 37 项单元测试全部通过。
- **Feel check**:
  - 手机上打开相册大图，用手指快速向左轻扫（Swipe Left）：观察被划走的照片是否顺畅向左飞出屏幕，随之下张照片自然呈现；
  - 轻轻拖拽 20px 后松开（未触发切图）：观察图片是否平稳弹回中央；
  - 确认松手瞬间再无先向右缩回再跳变的违和感。
- **Done when**: 照片大图与图片叠放组件的横向切图手势完全符合物理惯性。
