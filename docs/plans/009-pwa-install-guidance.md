# 009 PWA 引导安装与全平台适配计划

> 创建：2026-08-26 · 
> 状态：已完成

## 目标

实现优雅、克制、多端自适应的 PWA 引导安装体验（支持 Chromium 一键安装、iOS Safari 三步图文引导、内置 WebView 打开提示与 14 天免打扰机制），并打通 iOS Web Push 前置依赖。

## 步骤

1. 编写 PWA 安装状态管理 Hook（`usePwaInstall.ts`），捕获 `beforeinstallprompt`、检测 Standalone 与平台类型。
2. 补充 iOS 分享与安装专用单色矢量图标（`OrbitIcons.tsx`）。
3. 实现优雅的三步图文指引弹窗组件（`PwaInstallGuideModal.tsx`）。
4. 严格遵循无侵入最佳实践：不污染用户头像账号菜单，不滥用悬浮弹窗打扰用户。
5. 设置中心新增独立的「系统」→「关于」Tab（`AboutSettingsPanel.tsx`），展现版本号、运行模式与舒展的安装指引。
6. 支持场景驱动：「通知」偏好设置中针对 iOS 推送前置依赖自然提供添加引导。
7. 在全局 `Layout.tsx` 挂载按需引导弹窗（`PwaInstallGuideModal.tsx`），支持全端按需呼出。
8. 验证构建、静态检查与多端交互。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 成功打包
- [x] `node web/scripts/verify-pwa.mjs` 校验通过
- [x] 账号菜单保持纯粹，绝不塞入「添加到主屏幕」
- [x] 桌面端完全依赖浏览器原生地址栏安装能力，零打扰
- [x] 「主题与外观」保持纯粹视觉设置，彻底移出客户端卡片
- [x] 「设置」新增独立「关于」Tab，排版宽敞舒展、呼吸感充沛
- [x] 「通知」设置支持自然场景驱动引导，一键唤出图文指引
