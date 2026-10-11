# 伴侣随身手帖与公约浮层被截断困在首屏卡片内

> 创建：2026-09-19 · 
> 状态：已修复

## 现象

在“我们”页面点击伴侣名字（“示例用户乙”/“示例用户甲”）或相恋天数进入约定档案时：
- Web 端：浮层呈现为底部挤压卡片且包含移动端滑动条，样式与整体居中卡片规范割裂。
- 移动端：浮层顶部被截断（标题、拖拽把手和关闭按钮不可见），内容被困在高度为 160px 的首屏卡片内部并产生局部微小滚动条。

## 期望行为

- 遵循第一性原理与设计系统，伴侣档案与时光约定采用统一规范的对话框体系展示。
- 移动端与桌面端居中呈现，背景微毛玻璃模糊，标题、快捷编辑与关闭入口清晰完备。
- 无论所在父容器是否有 CSS 容器限制或截断，浮层均直接挂载至根节点（`document.body`）。

## 根因与修复

1. **CSS 包含块陷阱**：
   - `SpaceHeroCard.tsx` 将浮层直接挂载在 `.orbit-home-hero` 容器内。该容器设置了 `content-visibility: auto` 和 `overflow: hidden`，导致内部所有 `position: fixed` 元素的包含块被强制重定向为该 160px 的卡片，造成视口脱节与顶部溢出截断。
2. **不当复用专用手势组件**：
   - 随身手帖与公约直接复用了专为移动端快速发布器定制的 `BottomSheet`（250 行指针捕捉与滑动动量计算），在桌面端产生违和感与标题遮挡。
3. **架构修复**：
   - 基础组件 `web/src/components/ui/Modal.tsx` 通过 `createPortal(..., document.body)` 脱离 DOM 树包含块限制。坚守 Orbit 静默框架规范，标题栏仅保留纯净单体关闭图标，不强行塞入编辑图标，彻底消除图标因物理/视觉墨水面积不均产生的杂乱与不协调。
   - 重构 `UserAboutSheet.tsx` 与 `SpaceCovenantSheet.tsx`，全面回归经典 `Modal` 体系，遵循 60-30-10 配色与经典三元字体。编辑入口置于卡片底栏（Footer 右下角），契合“自上而下阅读、读毕再编辑”的自然心智与移动端单手操作工效。
   - 在 `SpaceHeroCard.tsx` 中使用 Fragment 将浮层从 `<section className="orbit-home-hero">` 中分离。
   - 针对长文本档案纵向撑满全屏的问题，优化模态最大高度为 `min(68dvh, 32rem)` 并为移动端保留充足的上下画布负空间（60-30-10 负空间美学），配合 16px 圆角与柔和滚动条。
   - 针对 iOS PWA 编辑聚焦自动放大（Auto-zoom）问题，依据 [027-ios-voice-transcript-input-auto-zoom.md](027-ios-voice-transcript-input-auto-zoom.md) 根因规范，移除表单控件上的 `text-sm`（14px），并将 `.orbit-ui-textarea` 与触控端控件字号强制绑定安全基线 `var(--type-control)`（≥ 16px），从根本上避免 WebKit 自动缩放。

## 回归验证

- `npm run typecheck` 与 `npm run web:build`：编译通过，0 类型错误。
- 桌面端实机测试（Chrome DevTools）：居中呼出浮层，标题思源宋体、副标题等宽对齐、编辑与关闭功能顺畅。
- 移动端模拟器测试（iPhone 390x844）：卡片比例舒展克制，上下各留约 20% 负空间画布，内容细腻滚动，彻底消除“撑满屏幕的压迫感”。
- iOS 触控聚焦验证：移动端输入框与 Textarea 聚焦时 computed `font-size` 严格为 16px，页面 1:1 稳态不缩放。
