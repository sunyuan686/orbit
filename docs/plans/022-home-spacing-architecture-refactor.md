# 首页间距架构重构（消除双重叠加与外边距）

> 创建：2026-09-03 · 
> 状态：已完成

## 目标

践行业界「Margin-Free Component」与「单一真相源」最佳实践，彻底消除首页 Flex 布局与 Section 遗留 margin-bottom 导致的 96px 双重间距叠加，理顺容器边距职责。

## 步骤

1. 记录 Bug 文档 `docs/bugs/015-home-section-double-spacing.md`。
2. 重构 `web/src/index.css`：
   - 移除 `.orbit-home-hero` 和 `.orbit-home-section` 上的 `margin-bottom: var(--space-section)`，消除外部 margin 侵入。
   - 增强 `.orbit-ui-stack--gap-2xl` 响应式节奏：移动端 `2rem` (32px) / 桌面端 `3rem` (48px)。
   - 清理 `.orbit-home` 容器重复冗余内边距，理顺 `<main>` 与 `<Container>` 的层次。
3. 验证构建与类型检查（`pnpm run web:build` / `typecheck`）。
4. 验证视觉渲染效果，更新状态为已完成。

## 完成标准（可验证）

- [x] `npm run web:build` / `tsc` 通过
- [x] 桌面端 Section 间距由 96px 恢复为规范的 48px
- [x] 移动端 Section 间距自适应收紧为 32px，首屏信息密度合理
- [x] 子组件无外部 margin，全权由 `<Stack>` 统一驱动
