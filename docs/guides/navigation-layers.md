# 导航分层规范（Navigation Layers）

本项目的浮层不是本地状态，而是历史条目。

---

## 一、不变量

> **任何可被返回手势关闭的界面，都必须对应一个由 React Router 创建的历史条目。**

系统返回手势（Android 返回键/手势、iOS 独立 PWA 左边缘滑动）本质是浏览器会话历史栈的 `back` 操作，**不是 JS 事件**。因此"浮层能否被返回手势关闭"完全等价于"浮层是否存在于历史栈中"。

由此推出两条禁令：

- **不要监听返回手势再补状态。** 那只是把第二套真相源挪进补丁，同时破坏 router 的历史记账。
- **不要手写 `window.history.*` 的写操作**（`pushState` / `replaceState` / `back` / `forward` / `go`）。条目由 React Router 记账（`history.state = { usr, key, idx }`），手写会让 `idx` 断链，路由拦截器会静默失效——官方对此有明确警告。`web/eslint.config.js` 已禁止。只读 `window.history.state` 允许，但仅限 `lib/` 与 `NavigationBootstrap`。

---

## 二、层级模型

| 层级 | 载体 | 示例 |
| :--- | :--- | :--- |
| 页面层 page | URL 路径条目 | `/albums/:id`、`/letter/:id` |
| 呈现层 layer | 同 URL + `location.state.layers` | 搜索、创作抽屉、图片灯箱、日期选择、通知面板、AI 面板 |

每个条目携带**完整层栈快照**（自底向上，如 `[{compose},{compose-tags}]`）。`isOpen` 判定的是"本层在不在栈上"，**不是**"是不是栈顶"——若退化成后者，子层一开父层的 `isOpen` 就变 false，父浮层被卸载、只剩子层悬空。

---

## 三、规则

1. **打开层**：`useLayer(key).open()` —— 压入一条同 URL 历史条目，地址栏不变。
2. **是否打开**：`useLayer(key).isOpen`，由 `location` 派生。**组件不持有 `useState(false)` 形式的 open 状态。**
3. **关闭层**：按钮、遮罩、`Esc`、返回手势**全部**收敛为 `useLayer(key).close()`（内部 `navigate(-1)`），不做"手势走了另一条路"的分支。`close` 只在栈顶确为本层时才回退，父层不得越权关闭子层。
4. **层内跳页面**：`navigate(to, { replace: true })` —— 把层条目换成页面条目，避免返回时复现浮层。
5. **不进栈**：阻塞型、不可关闭的界面（加载遮罩、强制更新提示）不创建条目。
6. **刷新策略**：仅由 state 承载的层，在启动时被 `NavigationBootstrap` 以 `replace` 剥离（会话历史会跨刷新保留条目状态，必须显式清除）；由 URL 承载的层随 URL 自然恢复。
7. **层内换内容**（如灯箱切下一张）：用**组件内部 state**，不要改历史——一次打开只占一条条目。历史只承载"哪一层在栈上"，不承载层里的细节。
   > 反例（2026-09-12 已修正）：图片灯箱原计划把当前照片放进 URL（`?photo=<assetId>`），那样每切一张都要 `replace` 一次，且"刷新/前进恢复到同一张"的解析逻辑要在每个宿主页各写一遍（正文的图集还得扫 HTML 重建）。改成层 + 内部 state 后，切图全程不碰历史。
8. **栈顶换层**（关掉 A 直接换成 B）：用 `replaceWith(nextKey)`。
   > 不要写成"先 `close()` 再 `open()`"：`close` 内部的 `history.go(-1)` 是异步任务，而 `open` 的 `pushState` 同步落地在前，随后那次回退会把刚压入的条目弹掉，表现为"新浮层根本没出现"。
9. **从非 React 代码打开层**（原生 DOM NodeView、第三方回调等，拿不到 hook 也没有 router 上下文）：不要自己去碰历史，而是**把"打开"的意图发给宿主**——模块级注册表（如 `lib/lightbox.ts` 的 `attachLightboxHost()`），宿主组件挂载时注册、卸载时注销，调用方只调一个普通函数。
   > 关键区分：走这条通道传的是**"看什么"（载荷）**，**"开没开"仍由 `location` 派生**。载荷不构成第二套真相源——它只在层已在栈上时决定渲染内容。
   > 另一个错误方向是"没宿主就退回命令式 DOM"，那会重新长出一套不参与历史栈的浮层，返回手势照样关不掉。

---

## 四、哪些界面该进栈

判据：**是否以整屏 / 底部抽屉形式呈现、用户会本能用返回手势关闭。**

命中才进栈。以下**保留局部 state**——进栈只会往历史里塞无意义条目，而它们的关闭本就由点外部 / `Esc` 承担：

- 锚定式轻量 popover：`ui/InfoTip`、`ui/FilterChipDropdown`、`AiChatPanel` 的布局菜单、`QuickComposeSheet` 的标签条、桌面侧栏账号菜单。
- 阻塞型确认框：`useConfirm`。
- 自动消散的事件播报：`MilestoneCelebrate`（无"关闭"动作）。
- 桌面端文档折叠栏：`TocRail` / `MarginaliaRail`（布局偏好，不覆盖内容）。

**已知代价**：`useConfirm` 不进栈，意味着在层内触发确认框后按返回手势，关掉的是它下面那一层（确认框随宿主组件消失），而不是确认框本身。这是刻意取舍——把每个确认框都做成层会让历史栈被"删除评论确认"这类一次性问句塞满，且不会造成数据损失（未确认即未执行）。

---

## 五、两条挂载约束

违反会出现"按一次返回没反应"或"两个浮层同时打开"：

1. **一个 key 只能由一个挂载点渲染。** 同一组件的两处挂载必须用不同 key（如外壳底栏的 `compose` 与首页信息流内的 `compose-card`）。
2. **层必须在它可能成为当前条目的所有路由下保持挂载。** 例：图片灯箱可由阅读态、编辑器全屏、相册详情多处发起，所以 `<LightboxHost/>` 挂在 `App.tsx` 路由之外（与 `NavigationBootstrap` 同级），放进路由内会随页面切换卸载、层条目被弹到一个无人渲染的位置。

---

## 六、页面返回按钮

- **左上角箭头这类通用返回符号**：`navigate(-1)`，与系统返回手势同源，不依赖历史栈深度。
- **需要就地替换当前条目时**（编辑器这类一次性页面、或需要在浮层打开时就地替换掉层条目）：显式目的路由 **+ `replace`**。
  > 显式路由若不加 `replace`，会留下**幽灵条目**——点完按钮再按返回手势，会退回到刚离开的那个页面。
- **底栏切换**：`replace`（换地方，不累积历史）。不加则每点一次底栏多一条记录，返回路径退化为"访问轨迹"。
- **移动端「菜单 → 二级面板」是真实层级**：进入用 push，面板内返回用 `navigate(-1)`；同屏换面板（桌面端左导航 + 右面板）用 `replace`。
- 冷启动直达深链时，`NavigationBootstrap` 会补根锚点把栈补成 `[/, target]`，所以上面的 `navigate(-1)` 在各入口下都安全。该分支只在 `history.state.idx === 0` 时触发，**刷新不触发**（刷新后条目仍由本 App 创建）。

---

## 七、改动路由或浮层时的自查清单

1. 浮层组件里还有 `useState(false)` 形式的 open 状态吗？
2. 新增的层是否落在 `useLayer` 上？key 与已有挂载点冲突吗？
3. 层内点击跳转是否用了 `replace`？
4. 是否引入了 `window.history.*` 写操作？
5. 页面返回按钮是 `navigate(-1)`，还是"显式路由 + `replace`"？有没有漏掉 `replace`？
6. 跑 `npm run web:build` —— **前端类型闸门在这里的 `tsc -b`**，根 `npm run typecheck` 不覆盖 `web/`。

设计与决策的完整推导见 [plans/055-navigation-layer-stack.md](../plans/055-navigation-layer-stack.md)；原始症状见 [bugs/041-mobile-pwa-back-gesture.md](../bugs/041-mobile-pwa-back-gesture.md)。
