# Bug #24：AI 历史记录抽屉与移动端视口边缘安全区双重累加治理

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-09-03 |
| 修复日期 | 2026-09-03 |
| 影响范围 | AI 聊天历史记录抽屉 (`AiConversationList.tsx` / `AiChatPanel.tsx`)、轻量创作弹窗 (`ComposeModal.tsx`)、全站移动端安全区避让规范 |
| 相关文件 | `web/src/index.css` |

## 现象与本质原因

### 1. 现象描述
在移动端（iPhone / iOS PWA 等具备灵动岛或刘海屏的设备）打开 AI 聊天面板的历史记录抽屉时：
- 顶部导航栏（`[✕] 新聊天 [+] [›]`）与下方的「历史聊天记录」文字之间出现异常巨大的空白区域（高达 90px 以上，占视口近 15% 高度）；
- 用户视觉上感知为内容断层与卡片布局塌陷。

### 2. 根因分析（第一性原理剖析）
1. **视口硬件避让 vs 内部坐标盒模型**：
   - `env(safe-area-inset-*)` 代表硬件物理遮挡尺寸（灵动岛、刘海、底部手势条），专属于**直接贴附在屏幕物理外边缘的顶层容器或操作栏（Bar）**；
   - 移动端 AI 面板采用纵向 Flex 布局，顶栏 `.orbit-ai-panel-header` 贴附屏幕顶部，**已全权承担顶部物理安全区的避让职责**（`padding-top: max(0.75rem, calc(0.5rem + env(safe-area-inset-top, 0px)))`）；
   - 顶栏之后的内容区 `.orbit-ai-panel-body` 及其子视图 `.orbit-ai-history-sheet`，其坐标原点位于顶栏下边缘，**天然已经处于安全区之内**。
2. **反模式：内容容器越权声明安全区（Double Safe-Area Inset）**：
   - 在 `web/src/index.css` 移动端媒体查询中，曾错误地为 `.orbit-ai-history-sheet` 声明了 `padding-top: env(safe-area-inset-top, 0px)`；
   - 导致顶部安全区被二次叠加：$\text{实际间隙} = \text{顶栏高度} + \text{Safe Area (59px)} + \text{重复的 Safe Area (59px)} + \text{列表内边距 (32px)} \approx 91\text{px}$；
3. **全站同类问题排查**：
   - 全面审计全站 18 处 `safe-area-inset-top` 与 13 处 `safe-area-inset-bottom`；
   - 发现 `.orbit-compose-header` 与 `.orbit-compose-footer` 存在同类隐患：在常规居中模态弹窗（Overlay 四周有 16px padding，并不贴屏）中直接挂载了 `env(safe-area-inset-*)`，导致居中浮窗在 iOS 上也被单侧撑高 59px。

---

## 解决方案（边缘单点避让原则）

1. **确立单一真相源，撤销越权安全区**：
   - 彻底删除 `web/src/index.css` 移动端样式中的 `.orbit-ai-history-sheet { padding-top: env(safe-area-inset-top, 0px); }`；
   - 确立由顶栏 `.orbit-ai-panel-header` 作为顶部安全区的唯一责任主体。
2. **重构列表语义留白与底端手势条承接**：
   - 移动端 `.orbit-ai-conversation-list` 顶部收敛为标准语义留白 `--space-md`（16px），标题栏内边距收敛为 `0.25rem 0.25rem 0.75rem`；
   - 因历史记录抽屉在移动端覆盖整个 body 直达屏幕物理底边（无底栏），列表滚动到底部的内边距自然承接底部手势条避让：
     `padding-bottom: max(2.5rem, calc(1.5rem + env(safe-area-inset-bottom, 0px)))`，保证滑到最后一条记录时不被 Home Indicator 遮挡。
3. **收敛居中浮窗的安全区作用域**：
   - 修正 `.orbit-compose-header` 与 `.orbit-compose-footer`，常规浮窗保持上下对称的 `12px 16px` 标准内边距；
   - 仅在真正贴顶贴底的全屏状态（`.orbit-compose-modal.is-fullscreen`）下启用 `safe-area-inset`。

---

## 验证标准

- `npm run typecheck && npm run web:build` 编译构建通过（0 error）；
- 移动端打开 AI 面板历史记录，顶部「历史聊天记录」与顶栏衔接紧凑自然，消除 59px 冗余空白；
- 滑动到历史列表最底部，最后一条记录与屏幕底部手势条保持安全间距，不被遮挡；
- 轻量创作弹窗在移动端居中展示时，头部和底部内边距对称工整。
