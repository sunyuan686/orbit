# 深色模式下冷启动/首屏瞬间白闪

> 创建：2026-09-11 ·
> 状态：已修复

## 现象

- 在系统深色模式或用户手动配置深色模式下，冷启动打开网页（Landing）或刷新页面时，页面出现一瞬间的白屏闪烁（FOUC）。

## 期望行为

- 冷启动全生命周期（原生画布 → 启动屏首帧 → 打包 CSS / React 挂载 → 会话就绪淡出）全程保持深色视觉连续，底色恒为 `#131315`，绝对零白闪。

## 根因与修复

第一性原理被违反的不变量：**首帧视觉状态必须自包含（Self-contained）。任何在打包 CSS 到达前绘制的 DOM，其样式与核心设计令牌必须在首帧 HTML 内同步就绪，绝不能依赖异步外部样式束。**

1. **关键令牌时序倒错**：`index.html` 启动屏与 body 样式曾依赖 `var(--color-bg, #fafaf9)`，误以为外部打包的 `index.css` 会解析提供变量。但打包 CSS 异步延迟加载，首绘时 `--color-bg` 未定义，强制降级走浅色 `#fafaf9`。
2. **缺乏原生 `color-scheme` 契约**：项目未声明 `<meta name="color-scheme">` 及 CSS `color-scheme: dark`，浏览器在解析阶段的 Root Canvas 默认使用纯白。
3. **启动屏首帧透明延迟**：`.orbit-boot` 曾带有 `0.15s` 的 `animation-delay`，前 150ms 处于 `opacity: 0`，将下方未着色的浅白底色暴露无遗。
4. **深色色值标准偏离**：`useTheme.ts` 运行时写入的 `theme-color` 为 `#1c1917`，未对齐 `DESIGN.md` 与 `index.css` 规范的 `#131315`。

修复（`web/`）：

| 文件 | 变更 |
|---|---|
| `web/index.html` | 1. `<head>` 声明 `<meta name="color-scheme" content="light dark" />`；<br/>2. 内联脚本同步注入 `d.style.colorScheme` 并立即同步 `<meta name="theme-color">`；<br/>3. 内联 `<style>` 直接声明自包含 Critical Tokens（`:root`, `html.dark`, `[data-bg]`）；<br/>4. 移除 `.orbit-boot` 的 150ms 透明延迟，建立 `t=0` 起完全不透明的实体画布 |
| `web/src/index.css` | `:root` 显式声明 `color-scheme: light;`，`.dark` 显式声明 `color-scheme: dark;` |
| `web/src/hooks/useTheme.ts` | 1. `applyDark` 联动 `root.style.colorScheme`；<br/>2. `theme-color` 统一为 `#131315`；<br/>3. 避免冷启动且主题未变时触发多余的 `data-theme-switching` 重排 |

## 回归验证

- `npm run typecheck` ✅
- `npx eslint web/src/hooks/useTheme.ts` ✅（0 错误）
- `npm run web:build` ✅（生产构建成功，`dist/index.html` 验证自包含关键令牌与 `color-scheme`）
- 手动时序验证：深色模式冷启动首帧 0ms 起直接命中 `#131315` 实体画布，彻底消除白闪。
