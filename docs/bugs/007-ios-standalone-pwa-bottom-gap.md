# iOS 桌面独立 PWA 底部出现系统级留白

> 创建：2026-08-29 · 
> 状态：上游 WebKit 缺陷 (跟踪中)

## 现象

在 iOS（特别是配备灵动岛与底部指示条的机型上）通过 Safari「添加到主屏幕」运行 Standalone PWA 时，屏幕最下方出现约 62px 的空白区域，导致页面无法实现沉浸式全屏。

真机诊断数据：
- `screen.height`: 874px
- `window.innerHeight` / `100dvh`: 812px（差值恰为 62px）
- `env(safe-area-inset-top)` 与 `env(safe-area-inset-bottom)` 均返回 `0`

## 期望行为

在配置 `viewport-fit=cover` 与 `display: standalone` 情况下，Web 页面视口应撑满物理屏幕高度（874px），并通过 `env(safe-area-inset-*)` 准确获取安全区以供内边距适配。

## 根因与跟踪

1. **根因**：
   - 确认属于 Apple WebKit 系统级已知回归缺陷：[**WebKit Bug 301994**](https://bugs.webkit.org/show_bug.cgi?id=301994)（Apple Radar: `rdar://184081721`），当前状态为 `REOPENED (P2)`。
   - 在 iOS Standalone 模式下，WebKit 错误将视口高度裁切为 812px 并将 safe-area-inset 报告为 0。
   - 底部 62px 区域属于系统原生层，任何 DOM 节点与 CSS 属性均无法触及。
   - Safari 标签页模式与 iOS 18 及更早版本不受此影响。

2. **当前最佳实践与缓解**：
   - 保持标准的 App Shell 架构（`position: fixed; inset: 0;`），不编写容易产生副作用的脆弱 hack 补丁。
   - 确保 `html/body` 及 manifest 的 `background_color`（浅色 `#fafaf9` / 深色 `#131315`）与主题色一致，使系统原生露底区域在视觉上与应用底色自然融为一体。
   - 持续跟进 WebKit 官方对 Bug 301994 的后续修复与发布。

## 视口诊断与真机监控方法

若后续 iOS 系统升级需验证 WebKit 是否已修复该缺陷，可在 `web/index.html` 的 `</body>` 闭合标签前临时注入以下轻量级全屏诊断脚本：

```html
<!-- 临时真机视口监控面板（测试完成后移除） -->
<script>
  setTimeout(function() {
    var d = document.createElement('div');
    d.id = '__vp_debug';
    d.style.cssText = 'position:fixed;bottom:0;left:0;right:0;z-index:999999;background:rgba(0,0,0,0.85);color:#0f0;font:11px/1.6 monospace;padding:8px 12px;pointer-events:none;';
    var ih = window.innerHeight;
    var sh = window.screen.height;
    var vv = window.visualViewport;
    var root = document.documentElement;
    var shell = document.querySelector('.orbit-shell');
    var lines = [
      'screen.h=' + sh + ' innerH=' + ih + ' gap=' + (sh - ih),
      'vv.h=' + (vv ? vv.height : '?') + ' vv.offTop=' + (vv ? vv.offsetTop : '?'),
      'docEl.clientH=' + root.clientHeight + ' body.clientH=' + document.body.clientHeight,
      'root#.offsetH=' + (document.getElementById('root') || {}).offsetHeight,
      'shell.offsetH=' + (shell ? shell.offsetHeight : 'N/A') + ' shell.clientH=' + (shell ? shell.clientHeight : 'N/A'),
      'SAI-top=' + getComputedStyle(root).getPropertyValue('env(safe-area-inset-top)'),
      'SAI-bot=' + getComputedStyle(root).getPropertyValue('env(safe-area-inset-bottom)'),
      'standalone=' + (navigator.standalone ? 'Y' : 'N') + ' dpr=' + devicePixelRatio,
    ];
    d.textContent = lines.join('\n');
    document.body.appendChild(d);
  }, 3000);
</script>
```

**判断标准**：
- 若 `gap=0` 且 `SAI-top` / `SAI-bot` 返回正确的物理点数（如 59px/34px），说明 WebKit 视口与安全区已恢复正常。

## 关联验证

- `npm run build` 构建与类型检查正常（无冗余私有前缀及补丁）。
