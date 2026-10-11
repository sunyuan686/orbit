# 移动端导航分层与外壳架构收敛

> 创建：2026-10-06 ·
> 状态：已完成

## 目标

一句话：以 `getActiveTabKey` 为单一真相源彻底收敛移动端外壳导航架构，废除碎片化嗅探与伪分类，确保根页面与次级页面层级分明、出口清晰，杜绝死胡同与导航割裂。

## 步骤

1. **确立单一真相源与导航契约 (`tabNavigation.ts` & `TabBar.tsx`)**：
   - 在 `tabNavigation.ts` 中明确根 Tab 判定。
   - `TabBar.tsx` 废除 `isUs` 等字符串包含逻辑，严格由当前激活 Tab 驱动。
2. **移动端外壳架构收敛 (`MobileShell.tsx`)**：
   - 彻底废除 `isUsSection` 等硬编码数组。
   - 根 Tab 页面（`isTabRoute`）：渲染 `TabBar` 与 `AiChatFab`；顶栏左侧仅在 `/us` 渲染抽屉菜单 `☰`。
   - 次级页面（`!isTabRoute`）：隐藏 `TabBar` 与 `AiChatFab`，顶栏左侧统一自动提供 `<` 返回按钮（调用 `navigate(-1)`）。
   - 将相册详情（`/albums/:id`）纳入沉浸式路由体系，与文章详情保持一致，消除双层返回条与外壳冲突。
3. **视口边距收敛 (`TabKeepAliveHost.tsx`)**：
   - 次级页面在隐藏 TabBar 后，底部内边距调整为贴合系统安全区的正常边距，消除多余空白留白。
4. **验证与测试**：
   - 运行前端类型检查与打包 `npm run web:build`。
   - 验证 `/memories`、`/settings`、`/albums/:id` 等次级页面的返回行为与视觉表现。

## 完成标准（可验证）

- [x] `npm run web:build` 编译打包 0 错误
- [x] 记忆星图页面（`/memories`）顶栏左侧呈现 `<` 返回键，点击安全返回上一级；底栏自然隐藏，星图无遮挡
- [x] 系统设置页面（`/settings`）顶栏左侧呈现 `<` 返回键，不再错误显示 `☰` 抽屉菜单；底栏自然隐藏
- [x] 相册详情页面（`/albums/:id`）沉浸式呈现，仅保留唯一的顶部操作返回栏，无双层冲突
- [x] 四大主 Tab 根页面（`/`, `/albums`, `/letter`, `/us`）底栏正常显示，`/us` 左侧正常展示 `☰` 抽屉菜单
