# 相册大图预览控制栏隐藏后无法唤醒与切图失效

> 创建：2026-10-06 · 修复：2026-10-07 · 状态：已完成

## 现象

1. **大图控制栏隐藏后无法唤醒**：在相册（`PhotoLightbox`）中浏览照片时，顶部的序号计数、左右切换按钮和右上角关闭按钮在 2 秒无操作后自动淡出隐藏。此时在 iPhone / 移动端触屏轻点照片，控制栏死活不出现；若轻点到照片上下方的留白背景，整个大图预览直接关闭并闪退回相册列表。
2. **控制栏隐藏后无法左右切换照片**：由于控制栏隐藏，左右切换按钮不可见且被 `pointer-events: none` 禁用；同时手势滑动监听仅挂在中间的图片卡片上，用户在屏幕上下留白处或边缘滑动完全无法触发切图，导致“控制栏消失后彻底无法切换照片”。
3. **桌面端无鼠标移动唤醒**：在 PC/桌面端，控制栏淡出后晃动鼠标无法唤出控制栏，仅能按键盘。

## 期望行为

1. **倒计时保持现状**：保留 2 秒（2000ms）无操作自动沉浸淡出机制；
2. **内容与蒙层意图解耦 (Card vs Backdrop Separation)**：
   - **轻点卡片外部空白背景**：无论控制栏显隐，100% 立即直接关闭大图退出（符合 Modal 蒙层点击直觉，一击即退，无迟滞感）；
   - **轻点图片卡片主体内部**：控制栏显隐切换（隐藏时唤出展示 2 秒，展示时主动沉浸隐藏）；
3. **全域滑动手势切图 (Full Viewport Swipe Arena)**：无论手指划在图片上还是上下背景留白处，向左向右滑动均可流畅切图，切图完成后刷新控制栏并保持 2 秒展示；
4. **意图清晰的退出机制**：轻点卡片外空白直接退出，下拉手势随时下拉退出，点按右上角关闭按钮退出；
5. **桌面端鼠标移动唤醒**：桌面端光标移动平滑唤醒控制栏，交互符合直觉。

## 根因与最佳实践架构设计

### 1. 致命根因：DOM 宿主层级与父容器 pointer-events 样式污染
- **根因剖析**：
  原实现中 `PhotoLightbox` 作为内联子组件渲染在 `AlbumDetailPage` 的 DOM 树中，其外层祖先是 App Shell 的二级页面容器 `.orbit-subpage-viewport`。
  当全屏灯箱打开时，页面样式增加了锁滚动的规则：
  ```css
  html.orbit-lightbox-active .orbit-subpage-viewport {
    pointer-events: none !important;
  }
  ```
  原本控制栏可见时，由于自身有 `pointer-events: auto`，按钮可以点击；一旦 2 秒后控制栏淡出变为 `pointer-events: none`，由于整棵 `PhotoLightbox` 挂载在 `.orbit-subpage-viewport` 内，**灯箱遮罩和图片直接继承了父级的 `pointer-events: none`**！
  导致真机触屏上所有事件（`touchstart`、`touchmove`、`touchend`、`click`）被浏览器在底层直接抛弃，任何后续的唤醒与切换完全失效。
- **最佳实践**：
  采用 React 原生 **`createPortal(..., document.body)`** 将灯箱挂载至 `document.body` 顶层，彻底与 App 内部视口容器 DOM 解耦，消灭一切样式与事件级联污染。
  同时清理 CSS 中的所有 `!important` pointer-events 黑魔法，使用干净标准的全局滚动锁。

### 2. 状态与手势关注点分离 (Decoupling Gesture Physics & HUD UI)
- **消除反模式补丁**：
  前期尝试通过 `wakeUpTouchRef`、`lastTouchTimeRef`、`Date.now() - t < 1200` 物理时间窗等方式在 touch 与 click 之间进行“补丁式拦击”，代码充斥胶水逻辑且脆弱易损。
- **标准架构设计**：
  - **物理手势专注拖拽与滑动**（`onTouchStart / onTouchMove / onTouchEnd`）：
    - 仅追踪移动位移向量 `(deltaX, deltaY)`；
    - 负责横向翻页阻尼与切图、垂直下拉释放退出（Pull down to dismiss）；
    - 手势层**绝不直接侵入或修改 `showControls` 显隐状态**；
    - 当发生拖拽/滑动时，标记 `isSwipingRef.current = true` 用于吸收后续跟随的微小合成事件。
  - **HUD 显隐与交互统一由 W3C 规范的 Click 状态机驱动**（`handleOverlayClick`）：
    - 动作 1：若点击目标不在 `panelRef` 内（即点在四周空白背景上），无论控制栏状态，直接 `onClose()` 一击退出；
    - 动作 2：若点击目标在 `panelRef` 内部（图片卡片上），切换控制栏（隐藏态唤出 2 秒，展示态主动隐藏）；
    - 按钮自身通过 `e.stopPropagation()` 独立处理切换与关闭。
  - **桌面端自然交互**：
    - `onMouseMove` 节流唤醒控制栏；
    - 键盘 Esc、左右方向键直觉操作。

### 3. 移动端媒体查询样式权重覆盖导致切换按钮未能视觉隐藏
- **根因剖析**：
  CSS 中 `@media (max-width: 640px)` 曾为 `.orbit-gallery-lightbox-nav` 声明了 `opacity: 0.9`。
  由于该选择器出现在样式表后半段，且与 `.orbit-gallery-lightbox-controls--hidden` 同属单个 Class 权重（`0, 1, 0`），导致在手机窄屏（<= 640px）环境下，左右切换按钮即便已被施加 hidden 状态类，其 `opacity: 0` 也被样式表靠后的 `opacity: 0.9` 强制覆盖，表现为“关闭按钮与计数器正常隐藏，但左右切换按钮始终留在屏幕上”。
- **最佳实践修复**：
  - 移除窄屏媒体查询中冗余的 `opacity: 0.9` 声明，仅保留尺寸微调；
  - 隐藏态升级为复合高优先级选择器 `.orbit-gallery-lightbox-controls.orbit-gallery-lightbox-controls--hidden`，确保控制栏全部子元素在隐藏时绝对受控。

## 验证项

- [x] 架构重构：`createPortal` 挂载顶层，消灭父容器样式死锁与所有胶水补丁（无任何时间窗比较与额外 ref 拦截）；
- [x] 控制栏 2 秒无操作自然沉浸隐藏（包含关闭按钮、左右切换按钮、序号计数器）；
- [x] 轻点卡片外部空白背景：无论控制栏显隐，100% 立即关闭退出大图；
- [x] 轻点图片卡片内部：隐藏时唤醒控制栏 2 秒，显示时主动隐藏；
- [x] 控制栏隐藏或显示时，左右滑动手势随时流畅切图，下拉手势随时退出；
- [x] 桌面端移动鼠标平滑唤出控制栏，左右方向键切图正常；
- [x] 移动端（窄屏 <= 640px）消除样式层叠覆盖，切换按钮与其它控制栏部件同步 100% 自然淡出隐藏；
- [x] 编译与自动化测试通过：`npm run web:build` 与 `npm test`（60/60）。
