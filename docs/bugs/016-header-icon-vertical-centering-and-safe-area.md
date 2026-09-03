# 顶部导航栏 Icon 垂直未居中、贴顶与拥挤问题

> 创建：2026-09-03 · 
> 状态：已修复

## 现象

顶部导航栏（`.orbit-header-bar`）右侧功能图标（搜索、通知、主题切换）严重上偏贴顶，未垂直居中；且横向间距过密，视觉局促拥挤。

## 期望行为

- 导航栏高度与内边距符合设计系统标准规范（56px 标准高度，上下等距对称）。
- 桌面端上下内边距各 10px，图标精准垂直居中；iOS Standalone PWA 正确累加顶部安全区（`env(safe-area-inset-top)`）且保留 10px 间距。
- 右侧功能图标按钮间距适度（8px），点击热区清晰独立。

## 根因与修复

1. **根因**：
   - `.orbit-header-bar` 在 CSS 中设置了 `padding-top: env(safe-area-inset-top, 0px)`，在 Tailwind v4 级联中覆盖了 JSX 的 `py-2.5`（`padding-top: 10px`）。
   - 在桌面端 `env()` 计算为 0px，导致顶部 padding 为 0px，底部 padding 为 10px，上下严重不对称。
   - 右侧按钮群使用 `gap-1`（4px），对 36px 按钮而言间距偏紧。
2. **修复（最佳实践）**：
   - 在 `.orbit-header-bar` 中使用 `calc(0.625rem + env(safe-area-inset-top, 0px))` 和 `padding-bottom: 0.625rem`，定义标准 `min-height: calc(3.5rem + env(safe-area-inset-top, 0px))`，从 JSX 移除冗余的 `py-2.5`，实现单一真相源。
   - 右侧操作群间距由 `gap-1` 提升至 `gap-2`（8px）。

## 回归验证

- [x] 构建与类型检查通过（`pnpm run web:build` + `pnpm run typecheck`）
- [x] 顶部导航栏桌面端上下内边距对称（各 10px），图标垂直完美居中
- [x] iOS Standalone PWA 适配安全区且保留基础内边距
