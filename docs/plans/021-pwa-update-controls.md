# PWA 主动更新与缓存控制施工计划

> 创建：2026-09-03 · 
> 状态：已完成

## 目标

实现全局 Service Worker 更新与缓存管理 Hook，并在「设置 -> 关于」面板与全局提示中提供主动检查更新、就绪版本激活与强制清除缓存刷新的功能。

## 步骤

1. 新增 `web/src/hooks/usePwaUpdate.ts`：实现基于 `useSyncExternalStore` 的 PWA 更新与缓存生命周期管理单例 Store，包含 `checkForUpdate`、`applyUpdate`、`forceRefresh` 等方法。
2. 重构 `web/src/components/SwUpdatePrompt.tsx`：消费 `usePwaUpdate` 统一状态。
3. 改造 `web/src/components/AboutSettingsPanel.tsx`：增加「检查更新」、「立即更新」、「清除缓存并刷新」的交互与反馈。
4. 增强 `web/src/components/UserAccount.tsx` 与 `web/src/pages/Settings.tsx`：新版本就绪时增加更新微提示。
5. 更新样式 `web/src/index.css`（如有需要）。
6. 全量验证 `typecheck`、`web:build`、`web:lint` 与交互。

## 完成标准（可验证）

- [x] `npm run typecheck` 检查通过
- [x] `npm run web:build` 打包通过（Vite PWA / SW 注入正确）
- [x] `npm run web:lint` 检查通过（改动文件 0 警告/错误）
- [x] 「设置 -> 关于」提供完整检查更新与强制刷新操作，Toast 提示符合规范
