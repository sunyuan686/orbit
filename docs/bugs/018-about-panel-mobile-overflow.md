# 关于页面移动端排版拥挤与冗余 Commit Hash 移除

> 创建：2026-09-03 · 
> 状态：已修复

## 现象

1. PWA / 移动端窄屏下，「设置 -> 关于」页面的「版本」行文字极度拥挤。`Orbit v0.2.0` 在空格处被压缩折行堆叠。
2. 版本行展示的十六进制 Git 提交指纹（如 `#d05a2f7`）给普通用户带来困惑，且抢占移动端宝贵的横向宽度。
3. 「缓存与重载」行长提示文字与操作按钮左右硬挤，留白不足。

## 期望行为

1. 彻底移除界面上的 Git Commit Hash 展示。
2. 版本号文字禁止折行（`white-space: nowrap`），与状态徽章和按钮间距自然呼吸。
3. 窄屏下复合操作行自适应上下布局，提升可读性与点击体验。

## 根因与修复

1. **移除 Git Commit Hash**：在 `web/src/components/AboutSettingsPanel.tsx` 中移除 `#{__COMMIT_HASH__}` 渲染，使主版本行回归纯净产品版本标识。
2. **优化版本行排版**：重构「版本」行结构，左侧垂直分布「版本」标签与 `Orbit v0.2.0`（并增加 `whitespace-nowrap` 禁止折行），右侧展示状态徽章与更新操作按钮，彻底解决横向超容被动断行的问题。
3. **缓存行移动端自适应**：为「缓存与重载」行增加 `orbit-settings-info-row--stackable`，在 `@media (max-width: 640px)` 下将说明文案与操作按钮调整为上下流式结构，让文案横向充分展开，按钮点击更安全舒适。

## 回归验证

- [x] `npm run typecheck` 0 错误
- [x] `npm run web:build` 编译成功，PWA / SW 注入无异常
- [x] `npx eslint web/src/components/AboutSettingsPanel.tsx` 0 警告/错误
