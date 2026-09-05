# iOS 点击录音文档编辑触发页面自动缩放

> 创建：2026-09-04
> 状态：已修复

## 现象

在移动端 iOS 设备（Safari / PWA / 内嵌 WebKit）中，点击录音卡片（或语音附件栏）的转写文稿进行编辑时，虚拟键盘升起的同时整个页面发生非预期的自动放大（Auto-zoom），导致页面布局被撑开并向左/右上偏移，失焦后视口无法自动复原。

## 期望行为

点击录音转写文稿编辑框聚焦打字时，视口比例保持 1:1 稳定，不触发任何浏览器系统级视口缩放。

## 根因与修复

### 根因分析（第一性原理）

1. **iOS WebKit 保护性启发式机制**：
   在触控手持设备上，当表单控件获得焦点时的最终计算字号（computed font-size）小于 16px 时，WebKit 会判定该输入框文字过小、未针对移动触控适配，为避免用户看不清输入文本和光标位置，强制触发页面自动拉近放大（Auto-zoom）。
2. **语义与层级错配**：
   转写文稿是可阅读、可精细校对的多行正文（Editorial Text），原样式将其误分配给展示性微型标签级别 \`var(--type-xs)\`（12px），既恶化了手机上的光标与点选工效，又跌破了 16px 安全基线。
3. **类选择器权重穿透**：
   此前 Commit \`0e5fd15\` 仅在全局标签选择器 \`textarea\` 上定义了 \`font-size: var(--type-control)\`（权重 0-0-1）。而 \`.orbit-voice-textarea\` 作为类选择器（权重 0-1-0）直接覆盖了全局防缩放规则。

### 修复方案（拒绝补丁，语义归位）

不引入 \`!important\`，不修改 viewport 禁止用户缩放（遵循 WCAG 1.4.4 无障碍规范），而是将表单控件的字号语义彻底归位至控件规范 Token：

1. **[web/src/index.css](file:///Users/sunyuan/Desktop/project/orbit/web/src/index.css)**：
   - \`.orbit-voice-textarea\`：将 \`font-size\` 从 \`var(--type-xs)\` 修正为 \`var(--type-control)\`（\`max(16px, 1rem)\`）。
   - 同时排查并清除其他散落的低于 16px 的输入控件硬编码（如 \`.orbit-compose-url-input\`、\`.orbit-compose-alt-input\`、\`.orbit-settings-bot-persona-textarea\`），统一接入 \`var(--type-control)\`。

## 回归验证

- 前端构建检查：\`npm --prefix web run build\` 编译通过。
- 在 iOS 触控设备或模拟环境下，聚焦录音文档编辑框，计算字号满足 ≥ 16px，页面保持稳定无缩放。
