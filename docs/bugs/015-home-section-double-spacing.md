# 首页 Section 双重外边距叠加导致 96px 异常空旷

> 创建：2026-09-03 · 
> 状态：已修复

## 现象

首页各主要区块（Hero、时光卡、最近照片、探索、最近动态）之间间距过大，视觉上非常空旷割裂，一屏有效信息过低。实测大模块间距高达 96px（设计规范标准为 48px）。

## 期望行为

- 遵循 `DESIGN.md` 标准模块间距（48px / 移动端 32px）。
- 遵循业界 Margin-Free 原则：Section 子组件不携带外边距，间距全权由父级 `<Stack>` 统一控制。

## 根因与修复

1. **根因**：
   在历史重构中，页面外层引入了 `<Stack gap="2xl">`（Flexbox `gap: 3rem / 48px`），但未清理子元素 `.orbit-home-hero` 和 `.orbit-home-section` 遗留的 `margin-bottom: var(--space-section) /* 48px */`。Flexbox 不折叠外边距，导致 `gap + margin` 累加出 96px。
2. **修复**：
   - 移除 `.orbit-home-hero` 和 `.orbit-home-section` 的外部 `margin-bottom`。
   - 优化 `.orbit-ui-stack--gap-2xl`，支持移动端 `2rem (32px)` / 桌面端 `3rem (48px)` 响应式规范。
   - 清理 `.orbit-home` 容器多余的内边距重叠。

## 回归验证

- [x] 构建与类型检查通过（`pnpm run web:build` + `pnpm run typecheck`）
- [x] 模块间距实测恢复为 48px（移动端 32px），消灭 96px 叠加
- [x] 组件回归 Margin-Free 封装，架构健壮可维护
