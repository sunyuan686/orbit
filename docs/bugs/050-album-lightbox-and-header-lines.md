# 相册打开瞬间闪现横线与布局跳变

> 创建：2026-10-06 · 状态：已修复

## 现象

1. **相册大图预览打开瞬间闪现横线**：在相册中点击任意照片打开大图预览（PhotoLightbox）瞬间，屏幕中央会闪过一条高度约 2px 的全宽细横线，随后图片加载完成才突兀撑开。
2. **进入相册/相册详情时横线突兀插入与双重顶栏**：相册列表与相册详情在骨架屏加载完成瞬间，页面内部带 `border-b` 的标题栏突兀插入，造成视口横线突现与 CLS 布局跳变；在移动端上，页面内部的标题栏与外壳 MobileShell 顶栏紧邻，产生视觉重叠与双重分割线。
3. **移动端顶栏静态底边切断首排内容**：移动端顶栏静态写死 1px 底边框，在相册打开及滚动穿过时，该线条生硬横切在照片流顶部。
4. **大图预览时底层页面内容仍能穿透滚动**：在相册中点击照片打开预览（PhotoLightbox）后，由于 App-Shell 独立滚动视口未被冻结且未约束触控行为，手势滑动穿透至底层相册网格，导致底层照片流在浮层下方持续移动，退出预览时浏览位置发生漂移。

## 期望行为

1. **大图预览沉浸无缝**：点击相册照片打开预览时，容器建立稳定的沉浸视口约束，零物理边框坍塌，无“2px 横线爆开”闪烁；
2. **移动端顶栏职责收敛**：移动端由 MobileShell 统一接管顶栏与返回操作，相册页面内收敛多余的标题栏与硬编码 `border-b` 横线，骨架屏与真实 DOM 同构无 CLS；
3. **顶栏分割线滚动动态显隐**：顶部吸顶栏在顶部静止时与背景无缝融合，滚动穿过时自然浮现，消除对首排卡片的硬生生割裂；
4. **全屏模态底层彻底冻结**：打开预览浮层时，App Shell 滚动视口处于原子冻结状态，触控手势零穿透，底层位置完全不动。

## 根因与修复（第一性原理）

1. **大图预览容器物理盒模型逆向依赖坍塌**：
   - **根因**：`.orbit-gallery-lightbox-panel` 带有 `border: 1px solid var(--color-border)`，但其高度完全依赖子元素 `<GalleryImage>`；图片异步加载前高度为 0，导致容器在挂载首帧物理坍塌为一条 2px 细横线，图片就绪后瞬间撑开。
   - **修复**：移除面板上多余的实体边框 `border: 1px solid`，改用全景柔和投影 `var(--shadow-modal)`；大图媒体容器 `.orbit-gallery-image-stack--lightbox` 赋予确定的自适应最小高度 `min-height: min(40vh, 280px)`，在首帧即维持稳定几何体态，从物理根源消除坍塌条件。
2. **移动端外壳与页面内标题层级职责割裂**：
   - **根因**：`AlbumsPage` 与 `AlbumDetailPage` 在移动端未收敛页面内标题，导致与 `MobileShell` 的 `orbit-header-bar` 堆叠出双重标题与双重 `border-b` 硬横线；骨架屏与真实 DOM 结构异构（容器、操作栏、列数均不一致），异步数据到达瞬间由上至下硬插分割线，触发 CLS。
   - **修复**：
     - `AlbumsPage`：移动端消除重复的“相册”大标题与硬横线，转为纯净留白驱动的微操作栏，桌面端保留书卷排版；
     - `AlbumDetailPage`：骨架屏改写为与真实页面 100% 同构（统一 `Container`、同构操作栏、严格一致的响应式网格列数）；移动端头图介绍去除割裂感极强的 `border-b`，由自然段落留白建立层级。
3. **App-Shell 架构下滚动锁盲区与事件冒泡穿透**：
   - **根因**：传统 `document.body.style.overflow = "hidden"` 仅针对以 body 为滚动宿主的传统网页；Orbit 属于 App-Shell 架构，真实滚动发生在内部独立的 `.orbit-subpage-viewport` 与 `.orbit-tab-viewport` 视口中；且 PhotoLightbox 浮层容器缺少 `touch-action: none` 与 touchmove 阻止传播，导致手势直接穿透至底层视口。
   - **修复**：
     - 在全局设计系统层级声明 `html.orbit-lightbox-active .orbit-subpage-viewport, html.orbit-lightbox-active .orbit-tab-viewport { overflow: hidden !important; pointer-events: none !important; }`，实现架构级视口冻结；
     - 浮层容器声明 `touch-action: none; overscroll-behavior: none;`，并在外层覆盖容器绑定非 passive `touchmove` 阻止默认行为，物理级彻底杜绝任何手势泄露到底层。

## 回归验证

- [x] 相册点击照片打开 PhotoLightbox 零横线闪现、零高度坍塌；
- [x] 相册打开预览期间底层照片流完全锁死，零穿透滚动，关闭后视口位置精确保留；
- [x] 相册列表与相册详情进入时无 CLS 布局跳变，骨架屏过渡自然；
- [x] 移动端顶栏与页面内层级清晰，无冗余双重标题与静态硬分割线；
- [x] 前端构建类型闸门 `npm run web:build` 0 错误通过；
- [x] 根目录类型检查 `npm run typecheck` 0 错误通过；
- [x] 全局单元与集成测试 `npm test` 60/60 全部通过。
