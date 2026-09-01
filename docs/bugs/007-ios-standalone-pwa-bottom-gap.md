# iOS 桌面独立 PWA 底部出现系统级留白

> 创建：2026-08-29 · 更新：2026-09-02
> 状态：修复已落地，**待真机回归**
>
> 排查思路复盘见 [`docs/guides/layout-debugging-methodology.md`](../guides/layout-debugging-methodology.md)。

## 现象

iOS 通过 Safari「添加到主屏幕」运行 Standalone PWA 时，屏幕最下方出现 62px 空白。

真机探针实测（iOS 26.5.2，874pt 屏）：

| 单位 / API | 实测 | 判定 |
| --- | --- | --- |
| `screen.height` | 874 | 物理屏高 |
| `100vh` / `100lvh` | 874 | ✅ 可信 |
| `100dvh` / `100svh` | 812 | ❌ 少 62 |
| `window.innerHeight` | 812 | ❌ 少 62 |
| `visualViewport.height` | 812 | ❌ 少 62 |
| `env(safe-area-inset-top)` | 62px | ✅ 真值 |
| `env(safe-area-inset-bottom)` | 34px | ✅ 真值 |
| `navigator.standalone` | true | 权威判据 |
| `display-mode: standalone` | no | iOS 上不可靠 |

## 期望行为

`viewport-fit=cover` + `display: standalone` 下，App Shell 应撑满物理屏高（874），
系统 UI 由 `env(safe-area-inset-*)` 单独避让。

## 根因与修复

### 根因：布局模型与尺寸单位互相矛盾

项目已选择 `viewport-fit=cover` **全屏延伸模型**——绘制区等于整块物理屏，
状态栏（62）与 home indicator（34）叠加其上，由 `env()` 单独避让。

但尺寸来源用的是百分比链：

```css
html, body, #root { height: 100%; }
.orbit-shell { position: fixed; inset: 0; height: 100%; }
```

百分比高度最终解析到 ICB，而 WebKit 在 standalone 下把 ICB 报成 **812**
（少算一个 `safe-area-inset-top`，WebKit #254859）。

**病根不是「WebKit 有 bug」，而是：选了全屏延伸模型，却用「跟随可见区」语义的尺寸来源。**
两者语义冲突，WebKit 的谎报只是把冲突暴露出来。

顺带澄清两个早期误判：

- **62px 不是底部 home indicator**，而是 `env(safe-area-inset-top)`。
  交叉验证：iPhone 14 Pro（852pt）差 59、iPhone 16 Pro（874pt）差 62，差值恒等于顶部 inset。
- **「`env()` 返回 0」是误测**。
  `getComputedStyle(el).getPropertyValue('env(safe-area-inset-top)')` 恒返回空串——
  参数必须是属性名，不能是属性值。正确读法下 env 一直返回 62 / 34，从未为 0。

### 修复：全屏高度统一取大视口，收敛为单一 token

全屏延伸模型下，App Shell 的高度语义就是**大视口**（large viewport）。
`dvh` / `svh` 是「跟随可见区」语义，属于另一套模型，本就不该用在这里。
因此这不是「换个单位绕开 bug」，而是**让尺寸单位回到已选模型的正确语义**。

```css
:root {
  --viewport-height: 100vh;   /* 基线：全平台无条件支持 */
}
@supports (height: 100lvh) {
  :root {
    --viewport-height: 100lvh;  /* 增强：显式大视口语义 */
  }
}
```

消费方（`web/src/index.css`）：`html`、`body`、`#root`、`body::before`、`.orbit-shell`。

`web/index.html` 的 critical style 先于打包 CSS 加载，沿用项目既有的
`var(--token, fallback)` 模式保证首帧正确：`height: var(--viewport-height, 100vh)`——
fallback 必须取 `100vh`（首帧阶段 token 未定义，此值需全平台无条件可用）。

### 跨平台（iOS / Android / 桌面）语义统一

本方案不包含任何平台分支，各平台行为由标准语义推导：

| 平台 / 模式 | 大视口取值 | 结果 |
| --- | --- | --- |
| iOS standalone | 874（物理屏高） | 修复目标场景 |
| iOS Safari 标签页 | 874（见下文 no-op 证明） | 逐像素不变 |
| Android Chrome standalone | 全屏（Chrome 如实上报，无 WebKit 谎报问题） | 原本就正确，保持正确 |
| Android Chrome 标签页 | 大视口（地址栏收起时的最大值） | 与改动前 ICB 行为一致 |
| 桌面浏览器 | 即窗口高 | 不变 |

`env(safe-area-inset-*, 0px)` 在无刘海 / 无手势条的安卓设备上自然解析为 0，
无需分支。`viewport-fit=cover` 为标准属性，Android 同样支持。

**兼容性兜底**：`lvh` 需 Chrome 108+（2022-12）/ Safari 15.4+（2022-03）。
老内核 WebView 或国产浏览器不支持时，若直接写 `--viewport-height: 100lvh`，
`var()` 替换出的值在计算值时刻非法，`height` 塌成 `auto`，全屏布局崩溃。
故用 `@supports` 做能力检测：不支持 lvh 的环境回退 `100vh`——按 CSS Values 4
两者语义恒等（`vh` 即大视口的别名），回退不是行为分支，是同一语义的两种写法。

**判据：这是修复而非补丁**

- **零 JS**——不嗅探 `navigator.standalone`、不做运行时变量覆盖、不需要抢跑脚本
- **无环境分支**——`@supports` 是能力检测（渐进增强），不是平台嗅探；
  三种环境（支持 lvh / 不支持 / standalone）最终取值语义一致
- **不依赖上游修复**——WebKit 修好 #254859 后也无需改动，`lvh` 本就是该模型的正确单位
- **符合 DESIGN.md**——「禁止硬编码尺寸，一律 Token 驱动」，全屏高度有了单一真源

### 保留 `.orbit-shell` 的 `position: fixed`

`Layout.tsx` 中 `.orbit-sidebar-panel` 与 `.orbit-overlay-scrim` 都是 `fixed inset-0`，
以 `.orbit-shell` 为包含块。保留 fixed 时二者随 shell 高度一起变 874，无需改动；
若 shell 退回 static，它们会改以 viewport（812）为基准，反而比 shell 矮 62px。

### 为什么 Safari 标签页模式无回归

改动前，Safari 标签页下 shell 走的是 `height: 100%` → ICB。iOS Safari 的 ICB 等于
**大视口**——这正是「iOS 100vh 比可见区高」这一经典问题的来源，也是 `dvh` 被发明的原因。
标签页模式下 Chrome 展开时 `innerHeight` ≈ 812，但 ICB 仍是 874。

改动后取 `100lvh`。按 CSS Values 4，`vh` 与 `lvh` 等价，故：

| 场景 | 改动前（`100%` → ICB） | 改动后（`100lvh`） | 结论 |
| --- | --- | --- | --- |
| Safari 标签页 | 874 | 874 | **严格 no-op** |
| Standalone | 812（WebKit 谎报） | 874 | 修复 |

即：本次改动只在 standalone 那条错误路径上生效，标签页模式行为逐像素不变。
真机回归时该项只需确认「和改动前一致」，无需期待任何视觉差异。

### 残留裸 `100vh` 的审计结论

全量审计后剩余 11 处裸 `100vh`（`.orbit-compose-modal.is-fullscreen`、
`.orbit-auth-page`、各面板 `max-height` 等）。因 `vh ≡ lvh`，它们在 standalone 下
同样解析为 874，**不是 bug 残留**，仅是未走 token（DESIGN.md 的字面要求）。
按最小改动原则本次不动，留作后续 token 一致性清理。

已确认 `dvh` / `svh` 全项目零残留——那才是真正错语义的单位。

### 补丁式代码全量审计（2026-09-01，用户指令复核）

对修复链及全项目移动端适配做了一次反补丁审计，结论：

**干净（无补丁）**：

- 视口修复本体：token + `@supports` 渐进增强，零 JS、零平台分支
- CSS 零 `display-mode` 分支、零设备专用 px（62/34/59 等 magic number 只存在于文档）
- `hover` / `pointer` 媒体查询是输入能力检测（标准适配手段）
- `index.html` 无运行时视口 JS（无 `--app-height`、无 resize 监听）
- meta 中的硬编码 hex（`#fafaf9` 等）是 token fallback 的必要复制——meta 不参与级联，无法引用 `var()`
- `-webkit-` 前缀（line-clamp / backdrop-filter / tap-highlight 等）均为标准前缀策略

**JS 平台检测——定性为检测而非补丁**（`usePwaInstall.ts`）：

- `isRunningStandalone()`：三信号 OR——`matchMedia(display-mode)` + `navigator.standalone`
  + `android-app://` referrer。后两者分别是 iOS / Android TWA 提供的标准信号；
  iOS 上 `display-mode` 不可靠（本 bug 探针实证报 `no`），`navigator.standalone` 是
  该平台唯一可靠接口。用途仅限安装引导 UI，不分支布局。
- `isIOS` UA 嗅探：仅选择安装引导文案（iOS「分享→添加到主屏」/ Android「菜单→安装应用」）。
  不存在能回答「该显示哪个平台安装步骤」的能力检测，文案选择用 UA 是通行做法。

**两个轻微发现——已按最佳实践对齐（2026-09-02）**：

1. `manifest.theme_color: "#1c1917"` 与 meta `theme-color` 对（`#fafaf9`/`#131315`）不一致。
   最佳实践（web.dev / MDN）：manifest `theme_color` 是静态单值、不支持
   `prefers-color-scheme`，应取「默认浅色背景值」并与 `background_color` 一致，
   避免 Android 启动屏浅色背景 + 深色应用栏的割裂。暗色模式是静态 manifest 的
   已知局限（Chrome 运行时会跟随 meta 更新，但安装时与启动屏仍取 manifest）。
   已改为 `#fafaf9`（`web/vite.config.ts`）。
2. `PwaInstallGuideModal` in-app browser 分支文案平台不感知。最佳实践：
   检测层 UA 正则是唯一手段（无能力检测可用，已有合规）；文案层平台感知——
   iOS 微信菜单是「在 Safari 中打开」，Android 是「在浏览器中打开」。
   已用现成 `isIOS` 做三元分支，Android 用户不再看到 Safari 字样。

另注：`manifest.orientation: "portrait-primary"` 锁竖屏只对 Android 生效，
iOS 忽略之——回归项「旋转横屏」实际只测 iOS。

### 底部安全区视觉归属（2026-09-02）

修复后底部剩 34px 安全区。调研（Apple 官方设计视频 / HIG + 美团·腾讯·少数派适配文 +
web.dev PWA 指南）确定三种行业模式：

| 模式 | 做法 | 适用 |
| --- | --- | --- |
| A 底栏表面延伸 | home indicator 背景 = 底栏背景的延伸（Apple 推荐） | TabBar / 输入栏 |
| B 内容流下潜 + 渐隐 | 内容滚到物理屏底 + scroll edge effect | feed 类页面 |
| C 静态背景填充 | 画布色填充安全区 | 无底栏页面 |

**结论：34px 是规范底线（HIG home indicator 34pt / MD3 手势导航），无可压缩空间；
「空白感」是视觉归属问题，不是数值问题。**

Orbit 现状诊断：
- `.orbit-sidebar-panel` 已符合模式 A（`--sidebar-bg` surface 延伸进安全区），无需改。
- `.orbit-ai-composer` 不符合任何模式——无自身背景，34px 露出 panel 的 `--color-bg`
  （与消息区同色、无边界），读作「卡片下方悬空白」。

**已实施**：composer 镜像 `.orbit-header-bar` 的「栏」语义（同 token、同概念、零新增）：
```css
/* @media (max-width: 767px) 内，普通 + fullscreen 两处 */
.orbit-ai-composer {
  padding-bottom: max(var(--space-md), env(safe-area-inset-bottom, 0px)); /* 原有 */
  background: var(--color-surface);
  border-top: 1px solid var(--color-border-light);
}
```
34px 一分不减，但从「画布色空白」变成「栏表面的一部分」，与 iOS 原生输入栏一致。
未采纳 iOS 26 Liquid Glass 悬浮胶囊（与 Orbit 留白克制的编辑气质冲突）。

### 二次筛查：同类问题与 token 债务（2026-09-02）

对全部 16 处 `env(safe-area-inset-bottom)` 使用点逐一核对背景归属，仅 `.orbit-compose-footer`
一处需处理（composer 已修、其余均合规）。已修复：

```css
.orbit-compose-footer {
  padding: 12px 16px max(12px, calc(12px + env(safe-area-inset-bottom, 0px)));
  background: var(--color-surface);   /* 新增：显式栏表面，替代父 modal 隐式同色兜底 */
  border-top: 1px solid var(--color-border-light);  /* 原裸 oklch fallback 已清 */
}
```
并删除 `.dark .orbit-compose-footer { border-color: oklch(0.25 0.01 80) }`——
`--color-border-light` 的暗色值（`#242429`）已由 token 提供，该裸 oklch 偏离 token 且冗余。

**遗留 token 债务（另行处理，不属本 bug）**：`oklch(0.9 0.01 80)` 共 7 处、
`oklch(0.25 0.01 80)` 共 4 处，散布在 compose 弹窗 header/footer/工具栏等「栏」元素，
均为历史遗留裸魔法值（`--color-border-light` 的 fallback 与暗色覆盖），
违反「禁止硬编码」铁律。语义上不触发（token 始终有定义），属死代码 + 偏离 token，
建议后续统一替换为 `var(--color-border-light)`。

### token 债务清理（2026-09-02，用户确认）

实际共 9 处裸值（6 处 `0.9` fallback + 3 处 `0.25` 暗色覆盖，此前 footer 那处已先清）：

- **6 处 `oklch(0.9 0.01 80)`**：均为 `var(--color-border-light, ...)` 的 fallback，
  token 恒有定义 → 直接删 fallback，保留 `var(--color-border-light)`。
  涉及 `.orbit-slash-footer`、`.orbit-compose-header`、`.orbit-compose-attachments-bar`、
  `.orbit-compose-attachment-card`、`.orbit-editor-toolbar`、
  `.orbit-fullscreen-article-overlay .orbit-editor-toolbar`。
- **3 处 `oklch(0.25 0.01 80)`**：均为 `.dark` 覆盖中的 `border-color`，
  暗色 `--color-border-light` 已是 `#242429`（token 提供），该行冗余：
  - `.dark .orbit-compose-header`（仅此一条）→ 整块删除
  - `.dark .orbit-slash-footer` / `.dark .orbit-editor-toolbar` → 仅删 `border-color` 行，
    保留各自的 `background`

删除后暗色 border 回落至 `--color-border-light` 的暗色值 `#242429`，语义更正确且合规。
注：这两个 `.dark` 块中的 `background: oklch(...)` 裸值属另一类债务（背景色），
未在本次 border 清理范围内，留待后续统一 token 化。

### 遗留：暗色 surface 层级 token 缺失（待决策，不属本 bug）

对 compose 编辑器全套暗色覆盖清点后，发现 11 个选择器的 `.dark` 覆盖写了
**6 档背景亮度**（0.15 / 0.16 / 0.18 / 0.2 / 0.22 / 0.24 / 0.26）与
**4 档边框深浅**（0.28 / 0.3 / 0.32 / 0.35），而暗色 token 体系仅有
`--color-surface: #1a1a1d` 与 `--color-surface-raised: #222226` 两档。

| 选择器 | 背景 | 边框 |
| --- | --- | --- |
| `.dark .orbit-slash-menu` | 0.18 | 0.28 |
| `.dark .orbit-slash-footer` | 0.15 | — |
| `.dark .orbit-slash-kbd` | 0.24 | 0.35 |
| `.dark .orbit-bubble-menu` | 0.2 | 0.32 |
| `.dark .orbit-link-toolbar` | 0.2 | 0.32 |
| `.dark .orbit-link-toolbar-input` | 0.16 | 0.28 |
| `.dark .orbit-compose-modal` | 0.18 | 0.28 |
| `.dark .orbit-compose-segment-btn.active` | 0.26 | — |
| `.dark .orbit-compose-alt-popover` | 0.22 | 0.32 |
| `.dark .orbit-compose-alt-input` | 0.18 | 0.3 |
| `.dark .orbit-editor-chrome` | 0.18 | 0.28 |
| `.dark .orbit-editor-toolbar` | 0.16 | — |

**定性**：这些不是「重复写同一值」的冗余，而是**有意的层级深浅**（footer 最暗、
segment 激活态最亮），本质是暗色 surface 层级 token 缺失，迫使各组件各自写死。
**本次不清理**：机械替换成 `--color-surface` / `--color-surface-raised` 会压平层级、
引入视觉回归（违反「正确性 > 简洁性」）。留待对照 DESIGN.md 补充
`--surface-*` 层级 token 后，再做引用替换。

另记录两类暂不处理的裸值（供后续参考，非本 bug 范围）：
- **遮罩半透明黑** `rgba(0,0,0,x)` 约 30 处：是「遮罩深度层级」语义而非颜色语义，
  强行 token 化会引入 `--overlay-1/2/3` 这类无意义命名，属过度设计。
- **深色表面上的白字** `#ffffff` 约 15 处：语义为「on-dark 文字」，
  token 体系当前仅有 `--color-on-primary`（用于 accent 按钮），是否补 `--color-on-dark` 待定。

## 回归验证

- [x] `npm run build` 通过（类型检查 + 打包）
- [ ] **从桌面图标打开**，底部 62px 空白消失
- [ ] 底部内容贴在 home indicator 上方 34px（原为 34 + 62 = 96px）
- [ ] Safari 标签页打开，地址栏展开 / 收起时布局不跳变
      （分析上为 no-op，仅需确认「与改动前一致」，见上文）
- [ ] 侧边栏遮罩完全覆盖到屏幕最下沿
- [ ] AI 聊天输入区：底部安全区呈现为「栏表面」（surface 背景 + 顶部分割线），
      而非画布色空白；普通与全屏两种模式均验证
- [ ] 冷启动 boot 屏无高度跳变
- [ ] 旋转横屏无异常

> 测试前必须**删除桌面图标重新添加**：`apple-mobile-web-app-status-bar-style` 与
> manifest 在安装时缓存，服务端改动对已安装图标无效。

## 诊断工具

`tools/ios-viewport-probe.html`（独立于 `public/`，不参与生产打包）。相对早期脚本的修正：

- 用正确的属性探针读 `env()`，不再返回空串
- 补测 `100vh` / `100lvh` / `100svh` / `100dvh` / `-webkit-fill-available`
- 把 `innerHeight` / `100vh` / `screen.height` 三条判定线画在 `height: 100vh` 的层内
- 「涂紫」把整层染品红——**本次据此确认 `100vh` 容器能画到物理屏最下沿**，
  从而排除「系统覆盖层不可达」的假设

探针页刻意不引 manifest，避免 `start_url: "/"` 把桌面图标劫持回首页。

**用法**：本地调试时 `vite dev` 起来后，把该文件放到任意静态服务的根路径下即可访问（或直接 `open` 该 HTML）。但探针测的值（四态视口单位、`env()`、`navigator.standalone`）只在 **iOS 真机 standalone 模式**下才「说谎」，桌面浏览器读到的是正常值，只能验证脚本逻辑、无法复现 bug。有效读数需在真机「分享 → 添加到主屏幕 → 从桌面图标打开」。

## 跟进

- Safari 26.3 / 26.4 / 26.5 / 26.6 发布说明中均无 Home Screen Web App 视口相关修复；
  当前最新版 Safari 26.6（2026-07-27）。
- WebKit #301994（状态栏 reclaim，rdar://184081721）仍为 `REOPENED / P2`。
  本次不修它：`env()` 实测值正确，状态栏避让由现有 `safe-area-inset` padding 处理。
- 持续跟踪 [#254859](https://bugs.webkit.org/show_bug.cgi?id=254859)。
  即便上游修复，本方案也无需回滚。
