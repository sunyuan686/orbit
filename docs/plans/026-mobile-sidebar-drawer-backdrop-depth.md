# 移动端侧边抽屉景深模糊与层级强化

> 创建：2026-09-03 · 
> 状态：已完成

## 目标

解决移动端打开主导航抽屉时背景完全清晰导致的文字/人像高频视觉竞争、层级塌陷（像分屏而非浮层）以及缺乏滚动锁定的问题，落地业界轻量景深失焦（4~6px blur）+ 抽屉微弥散投影的最佳实践。

## 步骤

1. 在 `web/src/index.css` 中：
   - 增加 `--shadow-drawer` 阴影设计 token（亮色/暗色适配）；
   - 为 `.orbit-overlay-scrim` 增加轻量景深模糊（`backdrop-filter: blur(5px)`）与平滑过渡；
   - 为移动端展开的 `.orbit-sidebar-panel--open` 增加右侧柔和阴影，确立 Z 轴悬浮高度；
   - 补充 `prefers-reduced-motion` 降级支持。
2. 在 `web/src/components/Layout.tsx` 中：
   - 展开状态添加 `.orbit-sidebar-panel--open` 语义类；
   - 移动端展开抽屉时锁定 `document.body.style.overflow = "hidden"` 防止背景穿透滑动，并在断点放大时自动恢复与关闭。
3. 验证构建、类型检查与移动端/桌面端交互表现。

## 完成标准（可验证）

- [x] `npm run web:build` / `npm run test` 通过
- [x] 移动端呼出菜单时背景具备克制的景深虚化（5px），文字与照片细节不再喧宾夺主
- [x] 抽屉右侧具备柔和弥散阴影，明确浮层层级
- [x] 呼出菜单时背景页面锁定禁止穿透滚动，关闭或缩放回桌面端时恢复
