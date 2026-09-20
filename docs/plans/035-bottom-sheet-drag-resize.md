# 底部抽屉（BottomSheet）拖拽调节大小与手势交互施工计划

> 创建：2026-09-06 · 
> 状态：已完成

## 目标

为 `BottomSheet` 增加跟手拖拽调节高度（自由调节/双档吸附）、轻触切换档位、下拉关闭手势，并联动优化 `QuickComposeSheet` 在展开态下的输入区弹性伸展，消除视觉拉手假隐喻。

## 步骤

1. 重构 `web/src/components/layout/BottomSheet.tsx`：
   - 基于 Pointer Events（`setPointerCapture`）实现统一跨端手势；
   - 顶部拉手及头部区域增大触控热区与视觉状态反馈；
   - 支持实时高度调节、双档位（便携 / 沉浸大屏 88vh）智能吸附、下拉阻尼滑动与释放关闭（Dismiss）；
   - 支持点击拉手快速切换档位，支持键盘 `ArrowUp` / `ArrowDown` 可访问性调节；
2. 联动更新 `web/src/components/layout/QuickComposeSheet.tsx`：
   - 抽屉拉大时，输入区自适应弹性拉伸（`flex-1 min-h-[110px]`），操作工具栏沉底，发挥大屏写作价值；
3. 执行自动化测试与编译构建（`npm run typecheck`, `npm test`, `npm run web:build`）；
4. 交互验证与验收。

## 完成标准（可验证）

- [x] `npm run typecheck` 零错误通过
- [x] `npm test` 全部 26 项测试通过
- [x] `npm run web:build` 前端构建通过
- [x] 顶部拉手支持触摸与鼠标平滑拖拽，无卡顿无跳变
- [x] 支持向上拖拽/点击拉手展开至 88vh 沉浸大屏，写作框自适应扩展
- [x] 在便携高度下继续下拉超阈值顺畅关闭抽屉
