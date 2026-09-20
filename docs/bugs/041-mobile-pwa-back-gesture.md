# 移动端 PWA 返回手势无法关闭浮层，且会误退路由 / 直接退出 App

> 创建：2026-09-11 · 
> 状态：已修复（外壳级 / 内容级 / 阅读级 / 灯箱 / 路由层级语义 / 深链根锚点 / 不变量固化 / 编辑器脏状态守卫 / AI 灯箱已全部落地并过测，见 [plans/055](../plans/055-navigation-layer-stack.md)）

## 现象

移动端（iOS 独立 PWA 左边缘滑动返回、Android 系统返回手势/返回键）下，返回手势不作用于当前浮层：

- 首页打开搜索框或创作抽屉后手势返回：浮层不关闭；Android 直接退出 App（历史栈深为 1），iOS 无响应。
- 列表 → 详情 → 打开图片灯箱后手势返回：iOS 上灯箱不关而底层路由退到列表（灯箱"悬空"）；Android 因 CloseWatcher 先关灯箱，需第二次手势才退路由。
- 编辑器有未保存内容时手势返回：绕过退出确认，路由直接卸载组件，内容静默丢失（编辑器无本地草稿持久化）。
- 设置页进入二级面板（`/settings?tab=*`）后手势返回：直接离开设置页，而非回到设置列表。

## 期望行为

- 返回手势关闭当前最上层可关闭浮层，底层页面不被改动；
- 无浮层时，返回手势按层级回退路由，不发生"跨层级"跳动；
- 存在未保存内容时，返回手势先请求确认；
- 冷启动直达深链时，返回手势回到首页而非退出 App。

## 根因与修复

### 根因（第一性原理）

1. **返回手势不是 JS 事件，而是历史栈的 back 操作。** Android 系统返回在无 CloseWatcher 消费者时执行 `history.back()`；iOS 独立 PWA 左边缘滑动同为 `history.back()`。因此"能否被返回手势关闭"完全等价于"是否存在于历史栈中"。
2. **界面状态存在两套并行真相源。** 路由栈由浏览器历史承载（7 条 Route），浮层栈由 React `useState` 承载。`web/src` 全域检索 `popstate` / `pushState` / `useBlocker` / `beforeunload` **零命中**——浮层栈从未进入历史栈。
3. **由 2 直接推出全部症状。** 返回手势只能退掉路由：一次手势同时改动两个层级（浮层留在原地 + 底层路由被退掉）；栈深为 1 时表现为退出 App。
4. **平台能力差异放大不一致。** 仅有两处原生 `<dialog>`（`components/EditorFullscreenOverlay.tsx:60`、`lib/lightbox.ts:273`）在 Android Chrome 126+ 由 CloseWatcher 获得"返回即关闭"；Safari 与 iOS 全系未实现 CloseWatcher，同一功能跨平台行为分裂。
5. **既有实现另有层级错位**，属同一类病的分支：
   - `pages/Settings.tsx:301,310` 二级面板以 `replace: true` 写 search 参数，不产生历史条目 → 手势返回跳过一层（**已修**：移动端改 push，面板内返回改 `navigate(-1)`；桌面端同屏换面板保持 replace）；
   - `components/layout/TabItem.tsx` 使用 `NavLink`，底栏切换累积历史条目 → 返回路径退化为"访问轨迹"（**已修**：`NavLink` 加 `replace`）；
   - `pages/ArticleView.tsx:252` 与 `pages/AlbumDetail.tsx:190` 的返回按钮用显式目的路由 push，留下"幽灵条目"——点完按钮再按返回手势会退回刚离开的页面（**已修**：统一改 `navigate(-1)`，与返回手势同源）；
   - 冷启动直达深链时栈里没有 App 内的上一层，返回手势直接离开 App（**已修**：`NavigationBootstrap` 补根锚点，把栈补成 `[/, target]`）；
   - 编辑器退出确认（`pages/ArticleEdit.tsx:441`）原先只挂在页内按钮上，无守卫层兜住 POP（**已修**：升级为 Data Router，接入官方 `useBlocker` 拦截 POP 与离开跳变，统一呼出三选一草稿对话框）。
   - 图片灯箱（`lib/lightbox.ts` 旧版）以命令式 `<dialog>` 直接挂到 `document.body`，**整个 DOM 节点在 React 树之外**：它的开关既不在 React state，也不在历史栈（按 Android 平台碰巧由 CloseWatcher 接管，iOS / Safari 完全失灵）；相册详情与相册页还各有一份近似的复制实现（`PhotoLightbox.tsx` / `pages/Gallery.tsx`，后者零引用、是 [bugs/036](036-photo-lightbox-navigation-and-gestures.md) 抽组件时的漏改）。**已修**：灯箱改由 `useLayer("lightbox")` 驱动（`LightboxHost` 挂在路由之外），`PhotoLightbox` 由 `useLayer("album-photo")` 驱动；`pages/Gallery.tsx` 删除；返回手势、关闭按钮、Esc、下拉、点遮罩、关闭全屏编辑后查看图片全部收敛为 `navigate(-1)`。

### 修复方向

不引入任何"监听返回手势再补状态"的代码（那仍是补丁，且会破坏 React Router 的 `idx` 记账）。根治点是**取消浮层的第二套真相源**：浮层改由 React Router 创建的历史条目承载（同 URL + `location.state`），开关状态从 `location` 派生，关闭路径唯一收敛为 `navigate(-1)`。

完整模型、迁移清单与分阶段步骤见 [docs/plans/055-navigation-layer-stack.md](../plans/055-navigation-layer-stack.md)。

### 已落地改动

| 文件 | 作用 |
|---|---|
| `web/src/lib/layers.ts`（新增） | 层的纯函数读写：`readLayers` / `topLayer` / `withLayer` / `withoutLayer` / `sameUrl`。条目携带**完整层栈快照** |
| `web/src/hooks/useLayer.ts`（新增） | `useLayer(key)` → `{ isOpen, open, close, replaceWith }`；`isOpen` 判定"在不在栈上"，`close` 仅在栈顶时 `navigate(-1)`，`replaceWith` 做栈顶换层 |
| `web/src/lib/layers.ts` | 追加 `replaceTopLayer`（栈顶替换，用于"关掉 A 直接换成 B"，避免两次导航的异步竞争） |
| `web/src/components/NavigationBootstrap.tsx`（新增） | 首帧前 `replace` 剥离 `location.state.layers`，阻止瞬时层跨刷新复原 |
| `web/src/App.tsx` | 路由之外挂载 `<NavigationBootstrap />` |
| `web/src/components/SearchModal.tsx` | 搜索层（`search`）；层内进页面改用 `replace` |
| `web/src/components/NotificationBell.tsx` | 通知面板层（`notifications`）；外点/Esc/遮罩/下滑/关闭按钮全部收敛为 `close`，点条目改 `replace` |
| `web/src/components/UsMenuSheet.tsx` | 用户菜单层（`us-menu`）由 MobileShell 驱动；`/settings` 链接去 `onClick` 改 `replace` |
| `web/src/components/layout/QuickComposeSheet.tsx` | 创作抽屉层（`compose`）；内嵌 `TagManageModal` 独立成子层（`compose-tags`）。`onSuccess?` → 必填 `onPosted`：发布后去向由调用方决定，组件不再"先关层再跳转" |
| `web/src/pages/Home.tsx` | 信息流内的创作抽屉用独立 key `compose-card`（与外壳同组件不同挂载点） |
| `web/src/hooks/usePwaInstall.ts` | store 里的 `guideModalOpen` 是第二个真相源，已删除；hook 内部组合 `useLayer("pwa-guide")`，对外暴露 `guideOpen` / `openGuide` / `closeGuide`。`triggerInstall` 的兜底路径改调 `openGuide` |
| `web/src/components/AiChatPanel.tsx` | 面板层（`ai`）；面板内会话历史改为子层（`ai-history`），返回手势先退历史再退面板 |
| `web/src/components/PwaInstallGuideModal.tsx`、`AboutSettingsPanel.tsx`、`NotificationsSettingsPanel.tsx`、`UsMenuSheet.tsx`、`NotificationBell.tsx` | 安装指引入口改走 `openGuide()`；从浮层内打开时叠加而非替换 |
| `web/src/components/layout/MobileShell.tsx`、`DesktopShell.tsx` | 各浮层开关由 `useState` 改为 `useLayer`（含 ⌘J / ⌘K 快捷键分支） |
| `web/src/pages/Albums.tsx`、`AlbumDetail.tsx` | 新建相册（`album-create`）、编辑相册（`album-edit`）、删除相册（`album-delete`）；删除后 `navigate("/albums", { replace: true })`，不留可返回的浮层条目 |
| `web/src/pages/Home.tsx`、`ArticleEdit.tsx` | 标签管理页面级挂载（`tags-home` / `tags-edit`）；编辑器全屏（`editor-fullscreen`，保留 `<dialog>` 渲染）、草稿询问（`draft-prompt`） |
| `web/src/pages/ArticleEdit.tsx` | 全屏退出改问"存草稿？"时用 `replaceWith("draft-prompt")`（层级深度不变），而非"先关再开" |
| `web/src/components/ScratchCard.tsx` | 刮卡弹层（`scratch`）；删除以 `autoOpenModal` 为初值的本地开关，换卡后自动展开改由 effect 调 `open()`，刷新不自行弹开 |
| `web/src/components/DatePicker.tsx` | 日期弹层（`date-picker:<id>`，key 绑定触发点 id 以支持同页多个实例）；移动端底部抽屉的四条关闭路径收敛为 `close()` |
| `web/src/components/TableOfContents.tsx` | 移动端目录抽屉（`toc`）；桌面折叠栏 `TocRail` 用 `useRailExpanded`（布局偏好），不进栈 |
| `web/src/components/MarginaliaRail.tsx`、`pages/ArticleView.tsx` | 移动端边注抽屉（`mobile-marginalia`）；props 从 `open`/`onOpenChange` 收敛为 `isOpen`/`onOpen`/`onClose`；「选中边注 / 添加边注 / 起草边注」三处入口改调 `open()`，换文章不再手动关（新条目不携带层） |
| `web/src/pages/ArticleView.tsx`（顶栏返回按钮） | 从显式目的路由 push 改为 `navigate(-1)`，消除"点完按钮再按返回手势会退回刚离开的详情页"的幽灵条目 |
| `web/src/pages/AlbumDetail.tsx`（顶栏返回按钮） | 同上，`navigate("/albums")` → `navigate(-1)` |
| `web/src/pages/Settings.tsx` | 二级面板历史语义分端：移动端 push（菜单→面板是真实层级）、桌面端 replace（同屏换面板）；`backToMobileMenu` 改用 `navigate(-1)` 与返回手势同源 |
| `web/src/components/layout/TabItem.tsx` | `NavLink` 加 `replace`：底栏切换不再累积历史条目 |
| `web/src/lib/layers.ts` | 追加只读的 `historyIndex()`（解析 react-router 记账的 `idx`），供根锚点判断 |
| `web/src/components/NavigationBootstrap.tsx` | 除剥离瞬时层外，新增冷启动根锚点：`idx === 0` 且非首页时 `replace` 到首页再 `push` 目标，栈补成 `[/, target]` |
| `web/src/lib/lightbox.ts` | `openMultiImageLightbox` 改为只组装载荷并转给宿主；DOM 构建拆成 `mountLightboxDialog(payload, onRequestClose)` 返回 disposer。`withLayer` 同 key 幂等 = "二次打开不堆条目" |
| `web/src/components/LightboxHost.tsx`（新增） | 全局灯箱宿主，挂在路由之外（`App.tsx`，与 `NavigationBootstrap` 同级）；开关状态完全由 `useLayer("lightbox")` 派生，宿主只额外持有"看什么"。模块级注册表 `attachLightboxHost()` 解决原生 DOM NodeView 拿不到 hook 的通道问题 |
| `web/src/components/PhotoLightbox.tsx` | 组件本身不动（仍受 `isOpen` / `onClose` 控制）；`AlbumDetail` 的 `previewIndex: number \| null` 拆成 `useLayer("album-photo")` 开关 + `previewIndex: number` 载荷 |
| `web/src/pages/AlbumDetail.tsx` | 灯箱改用 `useLayer("album-photo")` 驱动；点击照片改为 `setPreviewIndex(i); openPhoto()` 双重操作 |
| `web/src/App.tsx` | 路由之外追加挂载 `<LightboxHost />`（与 `<NavigationBootstrap />` 同级，确保层在所有路由下保持挂载） |
| `web/src/main.tsx`、`web/src/App.tsx` | 顶层架构升级为 Data Router（`createBrowserRouter` + `RouterProvider`），根外壳 `RootShell` 包含全局基础设施，解除 `useBlocker` 环境限制 |
| `web/src/pages/ArticleEdit.tsx` | 引入 `useBlocker` 守卫编辑器脏状态：侧滑返回（POP）与外部跳转时拦截并弹出三选一对话框，阻止静默丢稿；保存失败拒绝跳转；提交前置放行 |
| `web/src/components/AiChatPanel.tsx` | AI 配图大图预览收敛至全局 `openMultiImageLightbox`（`lightbox` 层），消除本地私有 `useState` 浮层；移动端左滑手势仅退出大图，AI 面板保持开启 |
| `web/src/components/NavigationBootstrap.tsx` | 补根锚点操作在 Data Router 下改为 `await` 串行执行，确保冷启动深链时序稳定 |
| `tests/layers.test.ts`（新增） | 覆盖层栈嵌套、幂等压层、保留非层状态、同 URL 不改地址、剥离层、非法状态不抛错、不污染原对象、栈顶替换（含空栈与嵌套父层不动）、`historyIndex` 的合法/非法入参 |
| `web/src/lib/scrollPositions.ts`（新增） | 内存级滚动位置映射表，以 `location.key` 为键，提供 passive 记录与负偏置安全钳位 |
| `web/src/hooks/useScrollRestoration.ts`（新增） | 第一性原理滚动容器恢复 hook：`useLayoutEffect` 首帧前同步对齐 POP 偏置、PUSH 重置为 0 |
| `web/src/components/layout/MobileShell.tsx`、`DesktopShell.tsx` | 接入 `useScrollRestoration`；`<Suspense fallback={null}>` 下沉至 `<main>` 内部插槽，外壳（Header/TabBar/Providers）永不连带卸载 |
| `web/src/App.tsx` | 空闲时通过 `requestIdleCallback` 预加载主支柱 Chunk（`Home`、`ArticleView` 等），消除返回异步等待 |
| `web/index.html` | 内联样式补充显式 HEX 背景色回退（浅色 `#fafaf9`，深色 `#131315`），消除 WebKit 手势快照销毁白闪 |
| `tests/scroll-restoration.test.ts`（新增） | 覆盖滚动偏置记录、提取、更新、负数钳位、多条隔离与清理逻辑 |

两条经实测确认的挂载约束（违反即出现"按一次返回没反应"或"两个浮层同时打开"）：
1. 一个 key 只能由一个挂载点渲染；
2. 层必须在它可能成为当前条目的所有路由下保持挂载。

不进栈的三类界面（保留局部 state，理由见计划 055 步骤 2）：锚定式轻量 popover（点外部 / `Esc` 关闭，进栈只会在历史里留下无意义条目）、阻塞型确认框（`useConfirm`，规则 5）、自动消散的事件播报（`MilestoneCelebrate`）。

## 回归验证

- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 通过（**前端类型闸门在这里的 `tsc -b`**；根 `typecheck` 是 `tsc --noEmit`，不覆盖 `web/`）
- [x] `npm test` 58/58 通过（含 `tests/layers.test.ts` 与 `tests/scroll-restoration.test.ts` 全部通过）
- [x] `npm run web:lint` 改动文件零新增 error（改动文件 eslint 0 错误 0 警告）
- [x] 移动端 / 浏览器实测：返回时滚动位置 100% 保持，外壳无卸载重建，无全屏白闪与刷新感
