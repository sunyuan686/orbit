# 012 - PWA App Shell 视口与全屏标准架构

**状态**：已完成 (Completed)  
**目标**：彻底摒弃任何补丁代码与私有前缀，采用业界 App Shell 黄金标准（`position: fixed; inset: 0; overflow: hidden;`），实现真正第一性原理的边缘到边缘（Edge-to-Edge）通铺。

---

## 第一性原理与标准设计
在 SPA 与 PWA 原生应用架构中，依赖跨组件的多层 `height: 100%` 传递链路容易因不同浏览器的视口计算差异而出现断裂。

**最佳实践标准解法**：
1. **根画布标准**：`html, body, #root` 保持简洁的 100% 满宽满高与主题底色。
2. **App Shell 边界固定**：
   - 启动过渡屏 `.orbit-boot` 采用标准的 `position: fixed; inset: 0;`，无论在任何平台和模式下均无条件充满物理视口；
   - 运行时主容器 `.orbit-shell` 采用标准的 `position: fixed; inset: 0; overflow: hidden;`，直接锚定物理屏幕四边，从架构上彻底根除高度截断；
   - 内部滚动区 `<main>` 使用 `flex: 1; overflow-y: auto;` 承载内容滚动与安全区内边距。
3. **零私有前缀 / 零魔数**：不使用 `-webkit-fill-available` 等实验性前缀，完全基于 W3C 标准 CSS 规范。

---

## 验证结果
- `npm run build` 0 错误编译通过。
- 启动过渡屏与主应用在移动端与 PWA 下均无缝全屏通铺。

## 遗留问题（2026-09-02 补充）

上述「100% 满宽满高」方案在 **iOS Standalone PWA** 下存在缺陷：
`html, body, #root { height: 100% }` 的百分比链最终解析到 ICB，而 WebKit 在
standalone 下把 ICB 谎报为可见区（少算一个 `safe-area-inset-top`，WebKit #254859），
导致底部出现 62px 系统级留白。

已由 `docs/bugs/007-ios-standalone-pwa-bottom-gap.md` 修复：全屏高度收敛为单一 token
`--viewport-height: 100lvh`（`@supports` 渐进增强回退 `100vh`），
`.orbit-shell` 保留 `position: fixed` 且高度改用该 token。详见 007 文档。
