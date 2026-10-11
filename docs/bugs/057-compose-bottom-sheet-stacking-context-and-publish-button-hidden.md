# 点击首页速记卡片发动态底部发布按钮被底栏遮挡

> 创建：2026-10-09
> 状态：已修复

## 现象

在移动端首页点击第一项「速记（开始记录 →）」卡片呼出“发动态”半屏抽屉时：
- 抽屉底部的整排操作工具栏与黑色的“发布”按钮被底部的固定导航栏（TabBar）完全遮挡，只在右下角露出一丝黑色按钮边角。
- 用户无法直接点击发布按钮完成动态发表。

## 期望行为

- 无论从首页速记卡片还是底栏中央「+」按钮唤起创作抽屉，抽屉遮罩与面板均应置于视口顶层（覆盖系统底栏）。
- 抽屉底部的工具栏与“发布”按钮完整展示并适配移动端底部安全区（`safe-area-inset-bottom`）。

## 根因与修复

### 根因分析（第一性原理）

1. **局部层叠上下文（CSS Stacking Context）限制**：
   - 首页 [`Home.tsx`](../../web/src/pages/Home.tsx) 挂载在主视口容器 `TabKeepAliveHost` 的各 Tab 容器 `.orbit-tab-viewport` 内，该容器设置了 `position: absolute; z-index: 10;`，从而创建了独立的局部层叠上下文。
   - 外层 [`TabBar.tsx`](../../web/src/components/layout/TabBar.tsx) 位于根外壳 [`MobileShell.tsx`](../../web/src/components/layout/MobileShell.tsx) 且设置了 `position: fixed; z-index: 40;`。
   - [`BottomSheet.tsx`](../../web/src/components/layout/BottomSheet.tsx) 原实现直接在组件树就地渲染、未挂载至根节点。即使自身设置了 `z-50`，其实际层级仍受限于祖先的 `z-10`，被外层 `z-40` 的 TabBar 强制遮盖。
2. **弹窗/抽屉宿主模型失范**：
   - 依据模态界面标准，所有浮层（Overlay / Dialog / Drawer）职责上均属于视口全局交互层，必须脱离局部 DOM 树与祖先容器约束。项目中 `Modal.tsx` 均使用了 `createPortal`，而 `BottomSheet.tsx` 此前遗漏了该宿主模型。

### 修复方案

在 [`web/src/components/layout/BottomSheet.tsx`](../../web/src/components/layout/BottomSheet.tsx) 中引入 `createPortal(..., document.body)`：
- 将抽屉统一传送至 `document.body` 顶层渲染，彻底消除任何父级 `position`、`transform`、`z-index` 或 `overflow` 带来的层叠上下文污染。
- 确保 `BottomSheet` 的 `z-50` 始终在根层叠上下文中高于底栏 `z-40`，保证遮罩与发布按钮完整可见。

## 回归验证

- `npm run web:build`：TypeScript 检查与打包全部通过（0 错误）。
- DOM 树审查：`BottomSheet` 成功挂载至 `document.body`，不再受 `.orbit-tab-viewport` 的 `z-10` 层叠上下文限制。
