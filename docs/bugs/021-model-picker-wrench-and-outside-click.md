# Bug #21：模型选择器全员扳手视觉噪音与点击空白无法关闭弹窗治理

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-09-03 |
| 修复日期 | 2026-09-03 |
| 影响范围 | AI 模型选择器 (`AiModelPicker`)、AI 对话面板 (`AiChatPanel`)、移动端与桌面端交互 |
| 相关文件 | `web/src/components/AiModelPicker.tsx`, `web/src/components/AiChatPanel.tsx`, `web/src/index.css` |

## 现象与本质原因

### 1. 现象描述
1. 打开 AI 模型选择弹窗后，列表中的每一个模型项右侧均悬挂着一个扳手配置图标，在触屏移动端（iOS/Android）尤其严重，造成强烈的视觉噪音与假性维护感。
2. 用户在展开模型选择弹窗时，点击屏幕上的空白区域（如聊天消息区、欢迎引导区），弹窗完全无法关闭。

### 2. 根因分析（第一性原理剖析）
1. **问题一：扳手常态全显**
   - 原先在桌面端通过 `:hover` 浮现扳手，在针对触屏做适配时（Bug #19），为了绕开 WebKit 的 hover 首击拦截，在 `@media (pointer: coarse)` 下将扳手设置为了常态显示（`opacity: 0.65`）。
   - 导致所有模型行（无论选中与否、无论是否支持参数调节）均常驻显示扳手图标，违反了 60-30-10 极简排版与克制美学。
2. **问题二：事件拦截导致 Document 点击捕获失效**
   - `AiChatPanel.tsx` 在外层 `<aside className="orbit-ai-panel">` 上硬编码了 `onPointerDown={(event) => event.stopPropagation()}`。
   - 移动端下该容器占满视口（100vw × 100vh），用户点击屏幕所有空白处，事件在 `<aside>` 层均被 `stopPropagation()` 强行拦截截断，无法冒泡至 `document`。
   - `AiModelPicker.tsx` 在冒泡阶段监听 `document` 的 `pointerdown`，因而永远无法感知外部点击，导致弹窗关闭逻辑失效。

---

## 解决方案（基于第一性原理，拒绝胶水补丁）

1. **心智模型归位：仅在当前选中模型呈现配置入口**：
   - 快速模型切换菜单的核心职责是“选择与切换”。未选中的项保持极简纯文本，点击直接切换；
   - 仅对当前生效（`selected === true`）的模型渲染扳手按钮，允许用户微调正在使用的模型规格（Context/Thinking）；
   - 样式精简：移除冗余的 `@media (pointer: coarse)` 与 `:hover` 伪类显示逻辑，常态呈现温和微弱的辅助色（`color: var(--color-text-muted); opacity: 0.75`），按压与激活态加亮。
2. **根治事件流阻断，规范遮罩判断**：
   - 在 `AiChatPanel.tsx` 中，将遮罩关闭判断改为精准校验 `event.target === event.currentTarget`，彻底移除 `<aside>` 容器上的 `event.stopPropagation()`；
   - 在 `AiModelPicker.tsx` 中，将全局外部点击监听器升级为捕获阶段监听（`capture: true`），形成双重防御，确保优先感知外部点击，安全关闭弹窗。

---

## 验证标准

- `npm run web:build` 与 `npm run typecheck` 编译通过（0 error, 0 warning）；
- 模型选择菜单展开时，仅当前选中的模型右侧显示扳手配置入口与勾选符号，其余未选中项极简纯净；
- 点击任意未选中模型可一键切换并关闭弹窗；
- 点击聊天面板空白区域（消息区、输入框外、顶部空白等），模型选择弹窗能即刻响应并平滑关闭。
