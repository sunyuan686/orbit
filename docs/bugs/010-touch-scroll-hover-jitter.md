# Bug #10：移动端触控滑动触发 Sticky Hover 导致高亮与位移跳动治理

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-08-31 |
| 修复日期 | 2026-08-31 |
| 影响范围 | 全站可滚动列表、首页探索 Bento 导航、相册、信件、设置页卡片 |
| 相关文件 | `web/src/index.css` |

## 现象与本质原因

用户反馈在移动端上下滑动浏览首页时，探索板块下的元素（如「记忆」卡片）会**莫名高亮变色、像被点击悬浮聚焦**，且手指划过时卡片**上下抽搐跳动（Jitter）**，体验较差。

深入分析第一性原理与 W3C 交互规范可知：

### 1. 移动端模拟悬停反模式（Sticky Hover）
- **根因**：移动端触控屏在 `touchstart` / `pointerdown` 阶段，浏览器会向下方触碰元素派发模拟 Hover。在未做输入介质限制的 `:hover` 规则下，手指刚触屏即触发高亮变色（图标背景变绿 `--color-accent-soft`、图标文字变绿 `--color-accent`），造成“未点击却自动聚焦选中”的视觉假象。

### 2. 垂直滚动与轴向平移冲突（Scroll Y Motion Conflict）
- **根因**：`:hover` 中声明了 `transform: translateY(-2px)`。手指接触时卡片向上弹起 2px，手势转为滚动或离开时掉回原位。连续滑动划过多张卡片时，卡片依次弹起落下，与系统原生平滑滚动形成剧烈视觉冲突。

### 3. 输入模态耦合（Input Modality Coupling）
- **根因**：未区分物理鼠标指针（Pointer: Fine）、触控按压（Touch/Active）与键盘无障碍导航（Keyboard Focus-visible），将本属于真鼠标悬停的深度浮起效果裸写在全端样式上。

---

## 解决方案（W3C 规范级系统性治理）

1. **输入介质严格隔离 (`@media (hover: hover) and (pointer: fine)`)**：
   - 将全站卡片（`.orbit-home-bento-tile`、`.orbit-home-photo`、`.orbit-polaroid-card`、`.orbit-letter-stack`、`.orbit-reply-mini`、`.orbit-desk-item`、`.orbit-theme-card`、`.orbit-canvas-card`、`.orbit-font-card`、`.orbit-fontsize-card`、`.orbit-memory-card`、`.orbit-ai-conversation-item` 等）的 `translateY` 悬浮位移与高亮变色统一收口在真鼠标媒体查询内。
   - 触控端滑动浏览时 100% 禁用 Hover，彻底消除误触发、高亮变色与轴向跳动。
2. **触控按压标准化 (`:active`)**：
   - 为卡片统一引入无轴向位移的微按压反馈（`transform: scale(var(--motion-press-scale))`），确保触控交互具有细腻按压质感且不破坏垂直滚动。
3. **无障碍焦点闭环 (`:focus-visible`)**：
   - 将 `.orbit-home-bento-tile` 与 `.orbit-home-story-card` 等组件统一纳入全局无障碍双层焦点环（`--color-focus-ring`），仅在键盘 Tab 导航时显示。

---

## 验证闭环

- `npm run build` 打包构建零错误零警告；
- 移动端触控上下滑动时，卡片保持静态平滑，无任何高亮闪烁或上下跳动；
- 移动端点击时触发细腻微缩放按压反馈；
- 桌面端鼠标悬停保持优雅的 `translateY` 浮起与主题色升温。
