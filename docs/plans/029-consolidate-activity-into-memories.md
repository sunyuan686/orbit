# 下线冗余活动入口与统一记忆资产架构

> 创建：2026-09-05 · 
> 状态：已完成

## 目标

从第一性原理出发，彻底清理历史遗留的独立活动页面（`/activity`）及其在“我们”页面的冗余入口，将所有热力图与时间印记资产完全统一收敛至“记忆星图”（`/memories`），消除打卡焦虑与死代码。

## 步骤

1. 在 `web/src/pages/Us.tsx` 中移除“活动足迹热力”冗余卡片，优化“系统与通知设置”布局。
2. 在 `web/src/App.tsx` 中将 `/activity` 重定向至 `/memories`，移除废弃的 `ActivityPage` 懒加载。
3. 删除已无任何引用的 `web/src/pages/Activity.tsx`。
4. 清理 `MobileShell.tsx` 与 `DesktopShell.tsx` 中对 `activity` 的冗余分支。
5. 运行 `npm run build` 进行全站构建与类型验证。

## 完成标准（可验证）

- [x] `web` 目录 `npm run build` 成功，类型检查 0 错误
- [x] “我们”页面去除冗余的活动足迹热力入口，视觉层级清晰
- [x] 访问 `/activity` 自动平滑重定向至 `/memories`，无死链
- [x] 彻底移除无用文件 `Activity.tsx`，无死代码残留
