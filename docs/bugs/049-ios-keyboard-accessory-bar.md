# Bug #49：iOS 移动端/PWA 全局表单键盘辅助栏（Accessory Bar）调研与治理备忘

> 创建：2026-10-06\
> 状态：待处理（调研已完成）\
> 影响范围：移动端全站、iOS Standalone PWA（搜索框、设置面板、评论输入、AI 对话、登录注册等所有 `<input>` / `<textarea>` 场景）

---

## 现象与全站表现

在 iOS Safari 或添加到主屏幕的 Standalone PWA 中，只要用户聚焦任意标准表单控件（`<input>`、`<textarea>`），软键盘顶部都会固定浮动一行黑色/暗色系统辅助工具栏（约 44px 高）：

1. **多输入框场景（登录注册、设置面板、空间配置）**：
   - 包含切换上一个/下一个输入框的上下箭头（`^` / `v`）；
   - 包含收起键盘的对勾/完成按钮（`✓` / `Done`）。
2. **单输入框场景（顶部搜索框、AI 聊天发送框、便签标题）**：
   - 上下箭头虽被系统自动灰显禁用，但**整条横栏与右侧的完成键依然常驻**，持续挤占 44px 的宝贵纵向高度。
3. **富文本编辑场景（Tiptap / `contenteditable`）**：
   - 不属于标准表单控件，无上下表单箭头，但可能出现系统自带的选择/撤销栏。

---

## 根因与业界现状调研

### 1. 核心根因
- **系统级 UI**：该栏由 iOS WebKit 底层的 `UIInputAccessoryView` 原生驱动，专用于网页表单的无障碍辅助与快速导航。
- **无 Web API 控制权**：无论在 Safari 还是独立 PWA 模式下，Apple 均未提供任何可用于隐藏或禁用该栏的 Web 标准或专有属性（无论是 `manifest.json`、`<meta>` 标签还是 CSS/JS）。

### 2. Apple / WebKit 的设计考量
- **防死锁保底机制**：移动端缺少物理键盘的 `Tab` 和 `Esc`。若允许网页随意关闭辅助栏，当页面未自建失焦收起逻辑时，用户极易被卡在键盘界面无法退出或切换字段。
- **User-Agent 主权**：Apple 将该工具栏划分为系统级浏览器外壳能力，不开放给网页脚本干涉。

### 3. 业界生态现状
- **纯 Web / PWA（Twitter/X、Notion、Linear 等）**：
  业界公认在纯 Web 层面无法技术抹除。主流产品选择与之共存，侧重于保证全站表单语义完整、流转顺畅和视口自适应，避免使用破坏性的前端 Hack。
- **原生 App / 混合外壳（Capacitor / 原生）**：
  原生控件（`UITextField`）天然不带此栏；而所有基于 WebView 的框架打包为客户端后，均通过原生层（如 `@capacitor/keyboard` 的 `setAccessoryBarVisible(false)` 或原生 `inputAccessoryView = nil`）全局一行彻底移除。

---

## 治理方案与演进路线

由于该问题贯穿全站所有输入场景，治理方案需要从全局架构视角考量：

### 路线 A：纯 Web / PWA 模式下的全站体验规范（当前保持 Web 架构时的做法）
不能强行消除，但可通过统一规范降低突兀感：
1. **全局统一的 `enterkeyhint` 规范**：
   - 搜索框统一配置 `enterkeyhint="search"`；
   - 对话/发送框统一配置 `enterkeyhint="send"`；
   - 表单跳转输入框配置 `enterkeyhint="next"`；
   - 终端提交输入框配置 `enterkeyhint="go"` / `enterkeyhint="done"`.
   让用户在任何输入场景下的注意力都聚焦于键盘右下角的主动作键，弱化上方辅助栏的存在感。
2. **全局视口防遮挡机制**：
   全站吸底浮动栏（如 AI 聊天、文章底栏）统一接入 `window.visualViewport` 适配，确保输入框与关键操作按钮不会被键盘和辅助栏遮挡。

### 路线 B：客户端原生壳包装（唯一能够全站彻底抹除的解法）
如果后续 Orbit 追求极致的原生应用质感（像素级消除全站所有输入框弹出的辅助栏）：
- 采用 **Capacitor** 进行轻量打包；
- 在 `capacitor.config.ts` 中全局配置：
  ```ts
  plugins: {
    Keyboard: {
      accessoryBarVisible: false,
    }
  }
  ```
- **无需改动前端任何业务页面**，底层自动全局抹去全站所有 `<input>` 的辅助栏，体验彻底与原生 App 对齐。
