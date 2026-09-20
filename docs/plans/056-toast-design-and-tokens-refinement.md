# 轻弹窗（Toast）通用组件化与设计系统重塑

> 创建：2026-09-11 · 更新：2026-09-12 · 状态：已完成

## 目标

一句话：摒弃“打补丁式修复”，从第一性原理出发，将轻提示（Toast）重构为设计系统级通用 UI 基础组件（`web/src/components/ui/Toast.tsx`），集中维护变体、图标与交互，解耦状态管理层与视图层。

## 核心设计决策（第一性原理）

1. **通用组件化，拒绝打补丁与分开维护**：
   - 在 `web/src/components/ui/` 目录下创建通用 `Toast.tsx`，集中导出至 `components/ui`；
   - 统一收敛变体（`success` / `error` / `info`）与单色图标映射（`CheckIcon` / `AlertIcon` / `InfoIcon`），消除业务与 Hook 层的任何私有分支特例。
2. **信息与交互降噪（全局彻底消除关闭按钮）**：
   - 全局所有 Toast 均为自动淡出的弱提示（4.2s / 2.8s / 3.2s）；
   - 彻底移除任何右侧微型关闭 `×` 按钮，全站统一保持极简纯粹的 `[ 单色图标 + 文案 ]` 居中纸签结构；
   - 容器统一支持整条轻点即退（`onClick={onDismiss}`），零视觉与操作负担。
3. **回归单色墨水图标与 60-30-10 规范**：
   - 移除实心填色圆形背景（彩色糖果盒），还原为 16px 单色细描边线性图标；
   - 成功图标绑定 `var(--color-accent)`，错误图标绑定 `var(--color-danger)`，信息图标绑定 `var(--color-text-secondary)`；
   - 深浅色模式自适应融合，暗色模式下绝无任何高亮白斑。
4. **统一几何与圆角秩序**：
   - 将孤立的 `9999px` 胶囊药丸调整为与全站卡片秩序一致的精致微圆角 `10px`（`var(--rounded-md)`），配合 1px 中性微灰边框与柔和阴影。

## 涉及文件

- `web/src/components/ui/Toast.tsx`：新建通用 UI 组件，定义 Toast / ToastStack 及变体图标映射。
- `web/src/components/ui/index.ts`：导出通用 Toast 组件。
- `web/src/hooks/useToast.tsx`：重构为纯粹状态管理层，渲染委托给通用 `Toast` 组件。
- `web/src/index.css`：样式规范化升级为 `.orbit-ui-toast` / `.orbit-ui-toast-stack`，支持 info 变体。

## 完成标准（可验证）

- [x] 深色模式与浅色模式下，Toast 背景、文字、边框均与系统主题色阶一致。
- [x] 全局所有 Toast 统一通过 `components/ui/Toast` 渲染，无实心彩色底盘、无任何右侧 `×` 叉号按钮。
- [x] 支持自动淡出与整条轻点消退。
- [x] `npm run web:build` 构建通过，无样式/类型报错。
