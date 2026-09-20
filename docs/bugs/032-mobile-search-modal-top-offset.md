# 移动端全局搜索浮层卡片过于贴顶体验不良

> 创建：2026-09-06 · 
> 状态：已修复

## 现象

移动端唤起全局搜索弹窗（SearchModal）时，弹窗卡片紧紧吸附在手机屏幕最顶端（距离顶部仅 14px~57px）。在未输入关键词时，卡片仅高约 170px，下方留下 75%~80% 的大面积空旷模糊暗区，视觉失衡；单手握持时手指向上点击输入框与“取消”按钮难度大。

## 期望行为

- 移动端搜索浮层卡片处于视觉与人体工学黄金区间，有舒适的自然顶部留白；
- 避免对 Web 桌面端 Spotlight 布局（12vh 顶部居中）产生任何影响；
- 保持直白纯净的 CSS 布局，无冗余胶水代码与状态侵入。

## 根因与修复

- **根因**：移动端媒体查询 `@media (max-width: 640px)` 中 `.orbit-search-modal-backdrop` 使用了 `max(0.875rem, calc(env(safe-area-inset-top, 0px) + 0.625rem))`，在标准视口中仅留有 14px（0.875rem）的顶部内边距，导致卡片紧贴天花板。
- **修复**：在 `web/src/index.css` 的 `@media (max-width: 640px)` 作用域内收敛 `--search-modal-top: max(4.5rem, calc(env(safe-area-inset-top, 0px) + 3.25rem));`：
  1. `padding-top` 采用 `--search-modal-top`，在非安全区场景保持 72px（约 8.5% 视口高度）舒适下沉，在灵动岛/刘海屏场景避让安全区并保留 52px 空间；
  2. `.orbit-search-modal-dialog` 的 `max-height` 相应收敛为 `calc(100dvh - var(--search-modal-top) - max(1rem, env(safe-area-inset-bottom, 0px)) - 1rem)`，确保在键盘弹起与长结果列表时顺畅内部滚动；
  3. 修改严格限定在移动端媒体查询内，Web 桌面端完全不受影响。

## 回归验证

- 通过 Chrome DevTools 移动端仿真（iPhone 14/15/16 390×844）实测：
  - 空状态提示与长结果列表状态下，卡片位置居中偏上，顶部留白适度，无紧贴感；
  - 搜索结果滚动正常，点击“取消”与背景暗区正常关闭；
- 切换至桌面端视口（1280×800）验证：Web 端 Spotlight 弹层位置、ESC 关闭与快捷键 Footer 完全保持原样；
- `npm run typecheck` 与 `npm run web:build` 验证通过。
