# Bug #9：移动端控件交互、弹窗聚焦与沉浸式阅读/编辑导航体系重构

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-08-31 |
| 修复日期 | 2026-08-31 |
| 影响范围 | 全站移动端弹窗/抽屉（`DatePicker`、`DraftDrawer`、`ComposeModal`、`ui/Modal`）、全局下拉气泡（`UserAccount`、`NotificationBell`、`AiModelPicker`）、沉浸式编辑页（`ArticleEdit`）与阅读详情页（`ArticleView`） |
| 相关文件 | `DatePicker.tsx`、`DraftDrawer.tsx`、`ComposeModal.tsx`、`ui/Modal.tsx`、`UserAccount.tsx`、`NotificationBell.tsx`、`AiModelPicker.tsx`、`Layout.tsx`、`index.css` |

## 现象与本质原因

用户反馈了三处严重的逻辑混乱：
1. **无法选到具体日期（如选 8.28 误跳到 8.14）**；
2. **二次点击日期无反应（事件被吞噬）**；
3. **点击编辑页返回误打开全站侧栏/面包屑导航**。

深入分析后，这并非单点缺陷，而是前端在处理「移动端事件模型」、「弹窗微滚动」与「导航层级权威」时违反了第一性原理而产生的四大系统性反模式：

### 1. 伪控件与事件拦截反模式（Fake Control Antipattern）
- **根因**：用原生 `<input readOnly />` 套在 `<div onClick>` 里伪装成按钮。在 iOS Safari / WebKit 中，满宽度的只读原生表单控件会拦截触控，既不触发 `focus` 也不冒泡 `click`，导致二次点击完全失灵。
- **第一性原理**：表单触发器如果只用于呼出弹窗，必须是语义化的 `<button type="button" aria-haspopup="dialog">`，严禁使用 `readOnly input` 打补丁。

### 2. 弹窗滚动抖动与聚焦漂移反模式（Auto-focus Layout Jitter）
- **根因**：子组件挂载时自动聚焦（`.focus()`）强行拉动了带有 `overflow-y: auto` 的抽屉视口，导致用户物理触控按下的瞬间，目标所在的同列（周五）上下日期发生垂直位移（8.28 坐标被拉扯为 8.14）。
- **第一性原理**：固定尺寸的模态抽屉必须显式声明 `overflow-y: hidden`，防止内部坐标系在触控阶段发生非预期跳变；日历单月视图禁用跨月显示（`showOutsideDays={false}`），消除同数字跨月混淆。

### 3. 双顶栏冲突与单一权威原则（Dual Header Collision）
- **根因**：应用外壳（`Layout.tsx`）与局部沉浸式页面（`ArticleEdit.tsx`、`ArticleView.tsx`）同时渲染顶栏，在窄屏下垂直堆叠（仅隔 30px），导致用户点击「返回 `←`」时极易误触外层的「汉堡菜单 `☰`」从而拉出侧边栏。
- **第一性原理**：单一视口内必须保持单一权威导航（Single Source of Truth）。沉浸式编辑与阅读详情页具有排他性，移动端外壳顶栏自动隐藏，由专有操作条（`orbit-editor-header` / `orbit-article-nav-bar`）作为唯一控制台，并对齐顶部安全区（`env(safe-area-inset-top)`）。

### 4. 移动端空白处点击监听缺失（Pointer vs Mouse Event Listeners）
- **根因**：全局气泡/抽屉只监听 `window.addEventListener("mousedown", ...)`，在移动端触控非交互空白区域时由于默认行为阻止，无法稳定关闭菜单；且部分 Modal 缺少 Body 滚动锁定与 ESC 键监听。
- **第一性原理**：全平台标准弹层统一采用 `pointerdown`，并标准化所有 Modal/Drawer 的 `overflow: hidden` 滚动锁定与键盘 ESC 退出支持。

---

## 解决方案

1. **`DatePicker.tsx` 全模式语义化**：
   - 彻底废除 `readOnly input`、`isTouch`、`inputMode` 胶水代码，`inline` 与 `default` 模式统一采用语义化 `<button type="button">`；
   - 抽屉采用 `overflow-y: hidden`，`DayPicker` 设置 `showOutsideDays={false}`，彻底消灭坐标漂移与日期错选。
2. **沉浸式阅读与写作导航一体化 (`Layout.tsx` & `index.css`)**：
   - 定义统一的 `isImmersiveRoute = isEditorRoute || isEntryDetailRoute`；
   - 移动端处于编辑态（`/:type/new`、`/:type/:id/edit`）与阅读态（`/:type/:id`）时，自动隐藏全局 `.orbit-header-bar`，由页面专有导航接管；
   - 移动端主容器 `.orbit-main--immersive` 动态适配刘海屏与灵动岛顶部安全区：
     `padding-top: max(0.875rem, calc(env(safe-area-inset-top, 0px) + 0.5rem)) !important;`
3. **全站模态与抽屉滚动锁定 (`ui/Modal.tsx` / `DraftDrawer.tsx` / `ComposeModal.tsx`)**：
   - 补充 `document.body.style.overflow = "hidden"` 滚动锁定与 ESC 键监听，防止手势穿透与背景滚动。
4. **全站下拉气泡事件标准升级 (`UserAccount.tsx` / `NotificationBell.tsx` / `AiModelPicker.tsx`)**：
   - 统一将外部点击监听由 `mousedown` 升级为现代 W3C 标准 `pointerdown`，确保在 iOS/Android/iPadOS 触摸空白处 100% 顺畅收起。

---

## 验证闭环

- `tsc -b && vite build` 构建零警告零错误通过；
- 日期点选 100% 准确，无任何位移与二次点击失效；
- 移动端阅读与写作页面进入完全沉浸态，导航栏独立且与系统状态栏保持黄金呼吸感，彻底消灭双顶栏。
