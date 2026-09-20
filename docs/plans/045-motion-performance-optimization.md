# 动效性能与交互渲染优化

> 创建：2026-09-09 · 
> 状态：已完成

## 目标

从第一性原理出发，基于浏览器 Composite > Paint > Layout 流水线模型与 `/fixing-motion-performance` 规范，对项目中的动画与手势进行三阶段性能重构：根除强制同步回流、限制高频 React 状态更新、抽离合成层动画并收敛模糊滤镜，严禁编写胶水代码。

## 步骤

1. **阶段一：回流消除与 React 渲染减负 (Critical)**
   - `TableOfContents.tsx`：移除 `scroll` 事件对标题 `getBoundingClientRect` 的逐帧轮询，改为基于 `IntersectionObserver` 监听可见性；
   - `useRealtimeVoiceStream.ts`：限制音量柱状态 `setVolumeBars` 触发频率至 ~15fps（约 66ms），匹配组件 `80ms` CSS 过渡曲线，杜绝 120fps React 全树重绘；
   - `BottomSheet.tsx`：抽屉拖拽全程固定物理高度，纯通过 `transform: translateY` 驱动位移，并移除释放动画中的 `transition: height`。

2. **阶段二：测量缓存与手势直操 DOM (High)**
   - `ScratchCard.tsx`：在 `pointerdown` 缓存 `canvas.getBoundingClientRect()`，消除 `pointermove` 中每秒上百次的测量调用；
   - `PhotoLightbox.tsx` & `MultiImageDeck.tsx`：手势滑动中通过 ref 直接操作 DOM `transform`，仅在 `touchend` 结算，避免高频 React 重绘；
   - `index.css`：将骨架屏 `.orbit-scratch-skeleton` 从 `background-position` 循环重绘迁移为伪元素 `transform: translateX` 合成层驱动。

3. **阶段三：滤镜与属性精细化治理 (Medium)**
   - `index.css`：全屏遮罩 `.orbit-overlay-scrim` 固化 `backdrop-filter: blur(5px)`，仅过渡 `opacity`；
   - 全局卡片与组件：收敛 `MomentCard.tsx`、`Albums.tsx`、`AlbumDetail.tsx` 与 `.orbit-voice-pill` 中的宽泛 `transition-all` 为具体精确属性；
   - `SpaceHeroCard.tsx`：首页英雄卡加入 `content-visibility: auto`，滑出视口时自动暂停后台渲染。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过，无类型报错
- [x] `npm run web:build` 编译打包与 PWA Service Worker 生成无异常
- [x] `npm test` 37 项单元与回归测试全部通过
- [x] 交互验证：文章滚动目录高亮顺畅、语音打字音波反馈平滑、抽屉与大图灯箱手势跟手无丢帧
