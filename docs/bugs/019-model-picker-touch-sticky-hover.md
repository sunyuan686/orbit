# Bug #19：移动端/PWA 下模型选择弹窗 Sticky Hover 假选中与交互拦截治理

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-09-03 |
| 修复日期 | 2026-09-03 |
| 影响范围 | AI 模型选择器 (`AiModelPicker`)、配置子属面板、移动端/PWA 交互 |
| 相关文件 | `web/src/components/AiModelPicker.tsx`, `web/src/index.css` |

## 现象与本质原因

### 1. 现象描述
在移动端 / PWA（iOS Safari / Standalone PWA）下，打开模型选择下拉弹窗时：
1. 列表顶部的未选中模型项（如 `qwen3.8-max`）呈现灰色胶囊背景，且右侧扳手配置图标显现，视觉上与实际选中的模型（如 `qwen3.8-flash`）高度雷同，造成“明明没选，却像被选中/聚焦”的视觉假象。
2. 用户在触屏上点击未选中的模型项时，首次点击常常未能直接切换模型并关闭菜单，而是仅将该项“点亮（变灰并显示扳手）”，需再次点击才会真正触发选中。

### 2. 根因分析（第一性原理剖析）
1. **iOS WebKit 的 Hover 陷阱（首击拦截）**：
   - 样式中定义了 `.orbit-ai-model-item-edit-btn { opacity: 0 }`，并在 `.orbit-ai-model-menu-item:hover .orbit-ai-model-item-edit-btn { opacity: 1 }` 时将扳手图标淡入。
   - **iOS WebKit 核心交互机制**：当元素的 `:hover` 规则会改变子元素的可见性（如 `opacity: 0 -> 1`）时，触摸屏上的首次 Tap 会被 WebKit 拦截为派发 `:hover` 状态，而**不会触发 `click` 事件**。必须二次点击才会触发真正的 `onClick`。
2. **触控设备 Sticky Hover（悬停粘滞）**：
   - 触屏设备无鼠标物理移出（`mouseleave`）机制。用户划屏滚动或触碰任何项后，WebKit 会将 `:hover` 永久保留在该项上。
3. **Hover 态与 Selected 态底色 100% 混同**：
   - 亮色模式下，`:hover` 底色为 `var(--color-surface-raised)`，而 `--selected` 底色为 `var(--sidebar-nav-active-bg)`，但后者在 Token 中直接映射为 `var(--color-surface-raised)`。两者背景色完全一致，触发 hover 即产生“假选中”感知。
4. **HTML 规范禁止非法嵌套（`<button>` 内部嵌套 `<button>`）**：
   - 外层列表项声明为 `<button role="option">`，内部右侧调节按钮又声明为 `<button className="orbit-ai-model-item-edit-btn">`。HTML5 规范严格禁止按钮内嵌套交互元素，在 WebKit 下会引发不可预期的点击捕获及焦点冲突。

---

## 解决方案（拒绝打补丁，从交互介质与 DOM 架构重构）

1. **合法化 DOM 架构与 WAI-ARIA 规范**：
   - 将外层列表项重构为合法的 `<div role="option" tabIndex={0}>`，与外层 `role="listbox"` 完全契合。
   - 保留内部扳手为合法的独立 `<button>`，阻止事件冒泡 (`e.stopPropagation()`)；外层容器支持点击选择和键盘 `Enter` / `Space` 导航。
2. **输入介质物理隔离 (`@media (hover: hover) and (pointer: fine)`)**：
   - 将模型项、配置子面板选项及底部「管理模型」按钮的所有 `:hover` 背景变化及子按钮显示逻辑，全部收敛至物理鼠标指针媒体查询内。
   - 触控端不再有任何 `:hover` 规则，彻底消灭 iOS 首击拦截（Tap 即 Select）与粘滞伪类。
3. **触屏端交互自适应**：
   - 触控设备（`(pointer: coarse)`）缺少 hover 探测能力，将扳手图标以低噪常态（`opacity: 0.65`）呈现，手指按压时为 `opacity: 1`，保证触屏用户可直观发现并直接点击配置。
4. **统一按压反馈 (`:active`)**：
   - 移动端与桌面端统一采用瞬时 `:active` 提供触摸反馈，手指抬起或移开时立即复原。

---

## 验证标准

- `npm run web:build` 与 `npm run typecheck` 编译 0 错误；
- 移动端/PWA 环境下单次点击模型项即可立即切换并关闭弹窗；
- 移动端滑动或触碰项时，绝不残留灰色粘滞背景；
- 移动端扳手配置按钮可直接点开配置，无需先触发 hover；
- 桌面端物理光标悬停时平滑显隐扳手与 hover 底色；
- 键盘导航可正常聚焦选项并按 Enter 切换模型。
