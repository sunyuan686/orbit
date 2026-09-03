# Bug #20：深色模式下发送按钮（AI 聊天与边注）对比度缺失与 CSS 权重泄漏治理

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-09-03 |
| 修复日期 | 2026-09-03 |
| 影响范围 | AI 聊天面板 (`AiChatPanel`)、边注提交按钮 (`InlineMarginaliaPopover`)、深色模式 Token 继承系统 |
| 相关文件 | `web/src/index.css` |

## 现象与本质原因

### 1. 现象描述
在深色模式（Dark Mode）下，进入 Orbit AI 对话界面或边注输入框时：
1. 底部输入栏右下角的发送按钮（`.orbit-ai-send-btn`）在默认无文字输入（禁用态）下，呈现为一个实心的纯灰圆块，完全看不到向上的发送箭头图标；
2. 输入文字（启用态）或悬停（hover）时，发送按钮依然存在颜色异常与对比度缺陷。

### 2. 根因分析（第一性原理剖析）
1. **像素级采样分析**：
   - 提取真实截图分析可知：按钮圆底灰度为 `rgb(109, 108, 112)`，内部箭头笔画灰度为 `rgb(113, 112, 116)`，二者差异仅为 3/255。
   - 表现为极端缺乏对比度的“白底画白线”，经由父级 35% opacity 共同透明化后，彻底沦为不可辨识的纯灰圆底。
2. **CSS 权重泄漏导致 Token 覆盖失控**：
   - 发送按钮采用标准设计系统语义 Token：
     ```css
     .orbit-ai-send-btn {
       background: var(--color-text-primary);
       color: var(--color-on-primary);
     }
     ```
   - 在浅色模式下：
     - `:root[data-accent="sage"]` 等预设选择器定义了 `--color-on-primary: #ffffff`，权重为 `(0, 2, 0)`（1 个伪类 + 1 个属性）。
   - 在深色模式下：
     - 其他色彩预设（`amber`、`rose`、`indigo`、`cola`）均显式声明了 `.dark[data-accent="..."]`（权重 `0, 2, 0`），并正确配置 `--color-on-primary: #131315`；
     - **唯独默认主题 `sage`（鼠尾草绿）被遗漏**，仅写在基础的 `.dark { ... }` 规则内（权重仅为 `0, 1, 0`）。
   - **核心破坏点**：由于系统初始化必然写入 `data-accent="sage"`，深色模式下权重更高的浅色规则 `:root[data-accent="sage"]`（`0, 2, 0`）无条件霸凌覆盖了深色模式的 `.dark`（`0, 1, 0`）。
   - 这导致深色模式下的 `--color-on-primary` 被错误篡改为浅色模式的 `#ffffff`，同时 `--color-accent` 亦被污染为浅色模式的暗绿。
3. **连锁影响**：
   - 任何在深色模式下依赖 `--color-on-primary` 的反色控件（包括 `.orbit-ai-send-btn`、`.orbit-inline-marginalia-popover-submit` 等），其前景文字/图标均变成了纯白，在深色浅底容器上导致对比度崩溃。

---

## 解决方案（拒绝打补丁，从 Token 继承拓扑与选择器权重彻底修复）

1. **补齐深色默认主题选择器并提升优先级**：
   - 在 `web/src/index.css` 的深色模式全色阶规范中，将基础深色规则及默认 sage 主题的选择器重构为：
     ```css
     :root.dark,
     :root.dark[data-accent="sage"],
     .dark,
     .dark[data-accent="sage"] {
       --color-bg: #131315;
       --color-surface: #1a1a1d;
       --color-surface-raised: #222226;
       ...
       --color-accent: oklch(0.78 0.11 150);
       ...
       --color-on-primary: #131315;
     }
     ```
   - 对其余深色主题同步加上 `:root.dark[data-accent="..."]`。
   - 这样深色模式的选择器权重达到 `(0, 3, 0)` / `(0, 2, 0)`，并在源文件顺序上位于浅色规则之后，无条件压制浅色模式属性选择器，杜绝 Token 意外泄漏。
2. **状态效果自洽**：
   - **禁用态**（输入为空）：浅灰圆底 `(108, 108, 111)` 上浮现清晰的深色箭头 `(29, 29, 32)`（对比度达 3.2:1 以上）；
   - **激活态**（有输入内容）：浅白圆底上黑箭头高反差呈现；
   - **悬停态**（Hover）：切换至深色高光亮鼠尾草绿，黑色箭头依然醒目。

---

## 验证标准

- `npm run build` 0 警告 0 报错；
- 深色模式下，无论是默认 `sage` 还是切换其他主题，AI 发送按钮均具有高对比度箭头；
- 边注按钮（`.orbit-inline-marginalia-popover-submit`）在深色模式下箭头展示正常；
- 浅色模式下所有主题色阶与按钮展示不受任何负面影响。
