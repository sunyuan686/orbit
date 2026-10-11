# 053 — 减弱动效适配与移动端触控悬停态隔离

- **Status**: DONE
- **Commit**: `ac57845`
- **Severity**: MEDIUM
- **Category**: 6. Accessibility / 1. Purpose & frequency
- **Estimated scope**: 4 files (`web/src/index.css`, `web/src/components/layout/TabItem.tsx`, `web/src/pages/Albums.tsx`, `web/src/components/MomentCard.tsx`)

## Problem

1. **Toast 通知缺失 `prefers-reduced-motion` 降级**：
   在 `web/src/index.css:8402-8408` 中，Toast 弹出和收起时同时执行了 `opacity`、`translateY(-0.75rem)` 和 `scale(0.94)`。在无障碍规范中，针对开启了「减弱动态效果（Reduced Motion）」的用户，应去除剧烈的位置移动（Position offset），保留透明度反馈即可，但目前样式中未提供任何降级媒体查询。

2. **移动端触控残留 Sticky Hover**：
   - 底部导航栏 [TabItem.tsx:22](../../web/src/components/layout/TabItem.tsx#L22)：使用原始 `hover:text-[var(--color-text-secondary)]`。在移动设备（如 iPhone）上轻触切换 Tab 后，该 Tab 会因触控伪悬停（Sticky Hover）而持续保留浅色未聚焦状态，直到点击其他位置才恢复。
   - 相册封面缩略图 [Albums.tsx:127](../../web/src/pages/Albums.tsx#L127) 与卡片 [MomentCard.tsx:164](../../web/src/components/MomentCard.tsx#L164)：使用了 `group-hover:scale-103`。手机触摸滑动列表经过卡片时，可能误触发微缩放，引起视觉跳动。

## Target

1. **Toast 减弱动效降级**：
   为 `.orbit-toast` 增加 `@media (prefers-reduced-motion: reduce)` 分支：仅过渡 `opacity`，移除 `translateY` 与 `scale`。
2. **触控与真鼠标悬停介质隔离**：
   - 将卡片与相册封面中的 `group-hover:scale-103` 收敛到 `@media (hover: hover) and (pointer: fine)` 下（或使用 Tailwind `can-hover:` / 专用 CSS 类）；
   - 修复 `TabItem.tsx` 中的伪悬停变色。

```css
/* target: web/src/index.css */
@media (prefers-reduced-motion: reduce) {
  .orbit-toast {
    transform: none !important;
    transition: opacity 150ms ease !important;
  }
  .orbit-toast--visible {
    transform: none !important;
  }
}

/* 仅在精细指针和支持真悬停的环境下触发封面缩放 */
@media (hover: hover) and (pointer: fine) {
  .orbit-album-cover-zoom:hover img {
    transform: scale(1.03);
  }
}
```

## Repo conventions to follow

- 参考 `docs/bugs/010-touch-scroll-hover-jitter.md`（Bug #10 已在首页卡片上建立的 `@media (hover: hover) and (pointer: fine)` 隔离范式）。
- 遵循 `STANDARDS.md` 第 6 节「Accessibility」原则：减弱动效不是完全消除动效，而是保留透明度与颜色，去掉大幅度位移。

## Steps

1. 在 `web/src/index.css` 的 Toast 样式块后（约行 8480）补充 `@media (prefers-reduced-motion: reduce)` 规则。
2. 检查 `web/src/components/layout/TabItem.tsx`：为 hover 状态添加真鼠标限定或改用 CSS 类。
3. 检查 `web/src/pages/Albums.tsx:127` 与 `web/src/components/MomentCard.tsx:164`，将 `hover:scale` 样式收敛到真鼠标环境。

## Boundaries

- 不影响桌面端鼠标指针悬停时的细腻缩放体验。
- 不影响 TabBar 本身的 active 选中状态展示。

## Verification

- **Mechanical**:
  - `npm run web:build` 构建通过。
- **Feel check**:
  - 在 macOS 系统设置中打开「辅助功能 > 显示 > 减弱动态效果」，触发保存或操作触发 Toast：确认 Toast 纯淡入淡出，没有上下跳跃；
  - 在移动端/iOS Safari 中连续滑动相册与动态流，手指扫过卡片时图片绝对保持平稳，不发生突发缩放；
  - 触控点击底部 TabBar，点击完毕立即恢复正确文字颜色，无悬停颜色残留。
- **Done when**: 彻底消除移动端 Sticky Hover，无障碍减弱动效完备支持。
