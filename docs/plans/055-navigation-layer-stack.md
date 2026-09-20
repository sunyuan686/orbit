# 导航层级栈（Navigation Layer Stack）

> 创建：2026-09-11 · 
> 状态：代码全部就位。阶段 1（内核）、阶段 2（外壳级 / 内容级 / 阅读级 / **灯箱**）、阶段 3（路由层级语义）、阶段 4（编辑器脏状态守卫 + Data Router 迁移）、阶段 5（深链根锚点）、阶段 6（固化不变量）、AI 配图灯箱收敛**代码全部就位并通过静态检查**。**全部手势类验收待真机实测**。

## 目标

一句话：消除浮层的第二套状态真相源 —— 让浮层成为 React Router 创建的历史条目，使系统返回手势在 iOS / Android 上按层级正确关闭浮层、守卫未保存数据、并在深链下回到首页。

## 不变量

> **任何可被返回手势关闭的界面，都必须对应一个由 React Router 创建的历史条目。**

违反此不变量的界面必然无法被返回手势关闭；用"监听返回手势再补状态"的方式维护第二套状态，只是把不变量挪到了补丁里，并且会破坏 router 的历史记账。

## 调研结论（为什么这样修）

| 候选方案 | 结论 | 依据 |
|---|---|---|
| 哨兵 `history.pushState` + `popstate` 手动关闭 | **否决** | React Router v7 持有条目记账权：`history.state = { usr, key, idx }`，`push()` 内 `index = getIndex() + 1`（`react-router/dist/development/chunk-JZWAC4HX.mjs:257-304`）。业务层手写 `pushState` 使 `idx` 断链，官方在同文件 `:1471` 明确警告此场景下 blocker 拦截 "will fail silently in production"。该方案同时仍保留两套真相 |
| 浮层改原生 `<dialog>` / `popover`，依赖 CloseWatcher | **仅作 Android 增强** | CloseWatcher：Chrome/Edge 126+、Firefox 149 支持，**Safari 与 iOS 全系不支持**（caniuse `wf-closewatcher`、webstatus.dev）。跨端不可依赖 |
| Navigation API（`navigate` + `intercept`） | **暂不采用，保留为未来传输层** | 已 Baseline 2026，但 Safari / iOS 需 26.2+，当前覆盖率不足；现在采用必须写兼容分支（违反"不写兼容胶水"） |
| 浮层即导航条目（同 URL + `location.state`），状态从 `location` 派生 | **采用** | 以 History API（由 router 记账）为唯一传输层；每个条目都有意义、可前进可后退；业界同类结论见 "Modals and the history API"（渲染依据为历史条目状态，而非独立布尔量） |

**唯一传输层 = History API，唯一写入口 = router 的导航 API，唯一真相源 = `location`。**

## 模型

| 层级 | 载体 | 示例 |
|---|---|---|
| 页面层 page | URL 路径条目 | `/albums/:id`、`/letter/:id` |
| 呈现层 layer | 同 URL + `location.state.layers` | 搜索、创作抽屉、图片灯箱、日期选择、动作面板、通知面板、AI 面板 |

规则（施工与评审共同依据）：

1. **打开层**：`navigate(location.pathname + location.search, { state: { layers } })` —— URL 不变，条目由 router 创建与记账。
2. **层是否打开**：`location.state.layers` 派生。组件不再持有 `useState(false)` 形式的 open 状态。
3. **关闭层**：按钮、遮罩点击、`Esc`、返回手势**全部**收敛为同一个 `navigate(-1)`，不做"手势走了另一条路"的分支。仅当本层位于栈顶时才回退（父层不得越权关闭子层）。
4. **层内跳页面**：`navigate(to, { replace: true })`，把层条目替换为页面条目，避免返回时复现浮层。
5. **不进栈**：阻塞型、不可关闭的界面（加载遮罩、强制更新提示）不创建条目。
6. **刷新策略**：**仅 state 呈现层**在 boot 时用 `replace` 剥离（会话历史会跨刷新保留条目状态，必须显式清除）；由 URL 承载的呈现层随 URL 自然恢复。
7. **嵌套**：条目携带**完整层栈快照**（自底向上），例如 `[{compose},{compose-tags}]`。父层在子层打开期间仍在栈上——`isOpen` 判定的是"在不在栈上"，不是"是不是栈顶"。**初版曾写成"每条条目只声明自己那一层"，那样父层的 `isOpen` 会变 false 导致父浮层被卸载、只剩子层悬空，已于 2026-09-11 修正。**
8. **层内换目标**（灯箱切到下一张）：`replace` 更新同一层条目的 URL 与 state，不新增条目——避免返回时要逐张退出。

挂载约束（违反即出现"按一次返回没反应"或"两个浮层同时打开"）：

9. **一个 key 只能由一个挂载点渲染。** 同一组件的两处挂载（外壳底栏的创作抽屉 `compose` 与首页信息流内的同名抽屉 `compose-card`）必须使用不同 key。
10. **层必须在它可能成为当前条目的所有路由下保持挂载。**

## 决策记录（已确认）

两个决策**均不影响返回手势是否生效**——两种载体的条目都能被返回手势关闭。它们只决定「哪些浮层拥有 URL 身份」与「刷新是否自动恢复」，因此可以保守起步、后续局部升级。

### 决策 1：哪些浮层改 URL

判据不是"能否分享"（Orbit 是私人空间，内容需登录、无 SEO，业界常用的"可分享"理由在此不成立），而是可验证的四问：**刷新后期望它还在吗？前进方向期望它重开吗？需要一个能直接打开的链接吗？还是只是"点开又关掉"的中间态？**

| 浮层 | 载体 | 依据 |
|---|---|---|
| 图片灯箱 | **state**（`lightbox` 层） | 2026-09-12 改判。原按"内容型浮层"归 URL（`?photo=<assetId>`），复核后发现这个 id 在活入口上并不存在：正文图片节点只存 `src`（`/assets/<sha256前缀>.<ext>`，`uploadAsset` 返回的 `id` 被丢弃），正文多图的图集是运行时数组、无法从单个 key 反推。要用 URL 就得在阅读页扫描正文 HTML 重建有序图集——"URL 即状态"退化成"从 URL 猜内容" |
| 设置二级面板 | **URL**（现状已是 `?tab=`，仅需 replace 改 push） | 它本就是"地方"而非"动作" |
| 搜索框 | state | 业界将"输入中的 search input"明确归为本地状态；结果状态已由 `/search?q=` 承载 |
| 创作抽屉、日期选择、标签选择、动作面板、确认框、通知面板、用户菜单、AI 面板 | state | 动作型/瞬时型。把 `isModalOpen` 这类布尔量塞进 URL 是被点名的反模式；Android 官方亦将 bottom sheet、search overlay、确认框归为 in-screen dismissal 而非导航目的地 |

### 决策 2：刷新后是否保留

- **瞬时呈现层：不保留。** 依据：Next.js 官方指南明确「下拉/气泡这类瞬时交互属于 transient interactions，不是持久视图状态；回到页面时它已经打开并不友好」，并在同类问题中给出的正解是**把状态从组件内部派生到 URL/参数上**——与本计划的模型一致。
- **灯箱：不保留。** 原先把灯箱列为唯一的 URL 呈现层，2026-09-12 复核后改判为瞬时层（依据见决策 1 表格）。刷新时灯箱关闭，与其它瞬时层一致——这是 `NavigationBootstrap` 剥离 `layers` 的自然结果，无需额外处理。
- **创作抽屉的草稿恢复不由导航状态承担。** 草稿属于数据层职责，Orbit 已有 `useDrafts` + 服务端草稿 + 单草稿缓冲（[042-single-draft-buffer-refactor.md](042-single-draft-buffer-refactor.md)）。正确做法是抽屉关闭时把内容落到草稿，而非让抽屉在刷新后自动弹开——导航状态不应承担持久化职责。

### 附带约束

Android 官方在 predictive back 的失败模式中列出「**Double dismiss**：回调与导航同时处理同一次返回」——这从平台侧印证了规则 3「关闭路径唯一收敛为 `navigate(-1)`」不是洁癖，而是必须。

## 步骤

1. **内核**（✅ 已完成）：
   - `web/src/lib/layers.ts`：纯函数、无 React 依赖、可单测。导出 `LayerSpec` 与 `readLayers` / `topLayer` / `withLayer` / `withoutLayer` / `sameUrl`；不提供 `writeLayer`，写入一律由 hook 经 router 导航 API 发起。
   - `web/src/hooks/useLayer.ts`：`useLayer(key)` 返回 `{ isOpen, open, close, replaceWith }`。`open` 在本层已在栈上时直接返回（防连点堆出多条条目）；`close` 仅在栈顶确为本层时 `navigate(-1)`；`replaceWith` 负责栈顶换层（规则 8 的横向情形）。三个动作标识恒定且始终读取最新 `location`（`locationRef`），可安全进依赖数组、可在 `await` 后调用。
   - `web/src/components/NavigationBootstrap.tsx`：挂载于路由之外，首帧绘制前把 `location.state.layers` 以 `replace` 剥离（决策 2）。
   - 不引入集中式 `LayerHost` 渲染器：浮层各自挂在外壳/页面的固定位置，集中化只增加一层间接寻址与一份映射表；`useLayer` 直接替换原 `useState` 开关，改动面最小。
2. **迁移浮层**（把 `useState` 开关改为 layer）：
   - ✅ 已完成（2026-09-11）：`SearchModal`（MobileShell / DesktopShell 双外壳）、`NotificationBell` 通知面板（`notifications`）、`UsMenuSheet` 用户菜单（`us-menu`）、`QuickComposeSheet` 创作抽屉（`compose` / 首页卡片 `compose-card`）及其内嵌 `TagManageModal`（`compose-tags`）、`PwaInstallGuideModal`（`pwa-guide`，见下方 store 处置）、`AiChatPanel` 面板（`ai`）及其内嵌会话历史（`ai-history`）
   - ✅ 内容级（2026-09-11）：`DatePicker`（key 绑定触发点 id，`date-picker:<id>`）、`ScratchCard`（`scratch`；删除以 `autoOpenModal` 作初值的本地开关，自动展开改由 effect 在换卡后 `open()`，刷新不自行弹开）、各页面的编辑/删除/新建弹窗（含 `TagManageModal` 在 Home / ArticleEdit 的页面级挂载）、编辑器全屏（保留 `<dialog>` 渲染，状态改由 layer 驱动）。`ActionSheetDialog` 与 `ui/Modal` 本身不自持状态，开关一律由调用方（`draft-prompt` 等层）驱动，无需改动
   - ✅ 阅读级（2026-09-11）：`MobileToc`（`toc`）、`MobileMarginalia`（`mobile-marginalia`）。两者的桌面形态（`TocRail` / `MarginaliaRail` 的 `hidden xl:flex` 折叠栏）是布局偏好（`useRailExpanded` + localStorage），不是覆盖内容的层，不进栈。`MobileMarginalia` 的 props 从 `open` / `onOpenChange(boolean)` 收敛为 `isOpen` / `onOpen` / `onClose`，与 `ui/Modal` 一致，不再有布尔二传手。
   - 仍以局部 state 保留（非层）：判据是**「是否以整屏 / 底部抽屉形式呈现、用户会本能用返回手势关闭」**。命中才迁移；锚定式轻量 popover 把 `useState(false)` 换成历史条目，只会在"点开又点掉"时往历史栈里塞无意义条目，而它的关闭本就由点外部 / `Esc` 承担。保留名单：`AiChatPanel.layoutMenuOpen`、`QuickComposeSheet.showTagPicker`、`ui/InfoTip`、`ui/FilterChipDropdown`、`UserAccount.menuOpen`（只挂 `DesktopShell` 侧栏，移动端不涉及）、`useConfirm`（阻塞型确认框，规则 5）、`MilestoneCelebrate`（3.2s 自动消散的事件播报，无"关闭"动作）、`TocRail` / `MarginaliaRail` 的桌面折叠栏（布局偏好，非覆盖层）。

   **豁免名单的已知代价**：`useConfirm` 不进栈，意味着在某个层内触发确认框后按返回手势，关掉的是确认框下面的那一层（确认框随宿主组件消失），而不是确认框本身。此代价值得——把每个确认框都做成层会让历史栈被"删除评论确认"这类一次性问句塞满，且不会造成数据损失（未确认即未执行）。

   **灯箱收敛**（✅ 已完成 2026-09-12）：灯箱改为**由 layer 驱动**，开关状态全部从 `location` 派生，关闭路径与其它浮层同源（`navigate(-1)`），返回手势可关。

   **载体改判（2026-09-12 用户裁决）**：计划原先定 `?photo=<assetId>` URL 层。复核发现这个 id 在活入口上并不存在——正文图片节点只存 `src`（`/assets/<sha256前缀>.<ext>`，`uploadAsset` 返回的 `id` 被丢弃）；`MultiImageDeck` 的图集是运行时数组，无法从单个 key 反推；AI 附件没有 asset 记录。要走 URL 就得在阅读页扫描正文 HTML 重建有序图集。**改判为 `location.state.layers`**：图集与当前张由打开方直接带入，不靠 URL 反推。

   | 实现 | 覆盖入口 | 处置 |
   |---|---|---|
   | `lib/lightbox.ts` + 新增 `components/LightboxHost.tsx` | 正文单图（阅读态点图 / 编辑态工具栏全屏预览）、正文多图叠放 | `openMultiImageLightbox` 只组装载荷交给宿主；DOM 构建拆成 `mountLightboxDialog(payload, onRequestClose)` 并返回 disposer |
   | `components/PhotoLightbox.tsx` | 相册详情 | 组件本身不改；`AlbumDetail` 的 `previewIndex: number \| null` 拆成 `useLayer("album-photo")` 开关 + `previewIndex: number` 载荷 |
   | `components/AiChatPanel.tsx` 内 `AiImageLightbox` | AI 配图 | **暂缓**，单独一轮；其 `src` 形如 `/ai-attachments/<filename>`（无 asset 记录、无 id，见 `.workbuddy/memory/2026-09-12.md`），且同时承载「用户发给 AI 看的图」，性质是会话附件而非空间资产 |
   | ~~`pages/Gallery.tsx` 内联~~ | ~~相册页~~ | **已删除**：`GalleryPage` 全仓零引用（`/gallery` 是 `Navigate → /albums`，实际渲染 `pages/Albums.tsx`），这条入口从来不存在。它本是 [bugs/036](../bugs/036-photo-lightbox-navigation-and-gestures.md) 抽组件时的复制品，删除后"灯箱有几套"不再有假象 |

   三点落法说明（可复用，已写进 guide）：

   1. **原生 DOM NodeView → React 的通道**：`extensions/OrbitImage.ts` 拿不到 hook、也没有 router 上下文，但它只有"打开某张图"一个意图要表达。通道收敛为一个模块级注册表（`attachLightboxHost()` / `host?.open(payload)`）：宿主挂载时注册、卸载时注销，调用方（DOM NodeView 与 React 组件）都只调 `openMultiImageLightbox`。**注意传的只是"看什么"，"开没开"仍由 location 派生**，所以没有引入与历史栈并行的第二套真相源。
   2. **宿主必须挂在路由之外**（`App.tsx`，与 `NavigationBootstrap` 同级）：灯箱可由阅读态 / 编辑器 / 相册详情多处发起，宿主放进路由内会随页面切换卸载，层条目会被弹到一个无人渲染的位置（挂载约束 2）。
   3. **保留 `<dialog>` 渲染**：`EditorFullscreenOverlay.tsx:25` 靠 `.orbit-image-lightbox-dialog[open]` 判断"有内层浮层吃掉了 Esc"。只把生命周期从"闭包自持"换成"disposer 驱动"，不重写视觉与手势。

   **store 与 layer 的关系（`PwaInstallGuideModal`）**：原先「指引是否打开」存在 `usePwaInstall` 的模块级 store 里（`guideModalOpen`），是第二个真相源，且 `triggerInstall()` 会在内部兜底打开它。处置方式：store 只保留环境特征（`hasPrompt` / `isStandalone`），`usePwaInstall()` 内部组合 `useLayer("pwa-guide")` 并返回 `guideOpen` / `openGuide` / `closeGuide`。`useLayer` 由 `location` 派生、无自持状态，多处调用共享同一真相，因此 hook 可以被任意多个组件调用而不产生分叉。`triggerInstall` 的兜底路径改调 `openGuide()`。无人引用的 `setPwaGuideModalOpen` 一并删除。

   **约定：从浮层内打开安装指引是「叠加」而非「替换」**——指引叠在当前浮层之上，返回先关指引、再关浮层。理由是不需要为这一处引入换层语义，且同一 tick 内先 `navigate(-1)` 再 `navigate(push)` 会因 `go(-1)` 是异步任务而丢失（push 先落地、随后 back 把新条目弹掉），顺序不可靠。**已在 2026-09-11 补上「栈顶替换」原语**（`replaceTopLayer` + `useLayer.replaceWith`），供「关掉 A 直接换成 B」的场景使用（目前用于编辑器全屏退出 → 草稿询问）；除此之外不要靠两次导航凑。
3. **路由层级语义修正**（✅ 已完成 2026-09-12）：
   - `Settings` 二级面板：移动端是「菜单 → 面板」的真实层级推进，改 **push**；桌面端导航与面板同屏，切换只是换面板，保持 **replace**（`setSearchParams({ tab }, { replace: !isMobile })`）。面板内的返回按钮改为 `navigate(-1)`，与系统返回手势同源。
   - 底栏 `TabItem`（`NavLink`）加 `replace`：切换不累积历史，否则每点一次底栏就多一条记录，返回手势会退化成"访问轨迹"。
   - 页面返回按钮统一为 `navigate(-1)`。原先 `ArticleView` / `AlbumDetail` 用显式目的路由 push，会留下**幽灵条目**——点完按钮再按返回手势，会退回到刚离开的那个页面。
   - **规则表述修正**：原写"返回按钮统一为显式目的路由"，但那与"返回按钮应与系统返回手势行为一致"直接冲突（返回手势就是 back）。正解是：显式目的路由**必须配 `replace`** 才不留幽灵条目；而左上角箭头这类通用返回符号，本身就应当就是 back。唯一保留「显式路由 + replace」的是编辑器（`ArticleEdit.doClose`）——它是一次性页面，且需要在「保存草稿？」层打开时就地替换层条目（规则 4）。
4. **脏状态守卫**（✅ 已完成 2026-09-13）：
   - **Data Router 迁移落地**：`App.tsx` 的 20 条路由改由 `createBrowserRouter(createRoutesFromElements(...))` 驱动，根基础设施集中于 `RootShell`，`main.tsx` 挂载 `RouterProvider`。
   - **`useBlocker` 接入**：在 `ArticleEdit.tsx` 中挂载官方 `useBlocker`，判断 `sameUrl(currentLocation) !== sameUrl(nextLocation) && needsDraftPrompt() && !isSubmittingRef.current` 时阻断导航。
   - **拦截后确认框**：统一驱动 `ActionSheetDialog`（`isPromptOpen = showCloseDialog || blocker.state === "blocked"`），保存后或丢弃后 `blocker.proceed()` 放行，取消或 Esc 则 `blocker.reset()` 留在编辑页，彻底杜绝 POP 侧滑返回或跳出导致的静默丢稿。
   - **AI 灯箱收敛**：`AiChatPanel.tsx` 移除独立的私有 `useState` 灯箱，图片预览统一走 `openMultiImageLightbox`（`lightbox` 呈现层），返回手势仅退大图、不退 AI 面板。
5. **深链根锚点**（✅ 已完成 2026-09-12）：`lib/layers.ts` 新增只读的 `historyIndex(historyState)`（解析 react-router 记账的 `idx`，非法值保守取 0）；`NavigationBootstrap` 在首帧前判断「当前非 `/` 且 `idx === 0`」——即冷启动直达深链、栈里没有 App 内的上一层——此时先 `replace` 到首页、再 `push` 原目标，把栈补成 `[/, target]`，返回手势即回到首页。两条导航同批完成，中间态不绘制。**刷新不触发**（`idx > 0`，历史条目仍由本 App 创建，返回本就安全），因此不会破坏"刷新后留在原地"。
6. **固化不变量**（✅ 已完成 2026-09-12）：
   - 新增 [docs/guides/navigation-layers.md](../guides/navigation-layers.md)：不变量、层级模型、8 条规则、进栈判据与豁免名单、两条挂载约束、页面返回按钮规则、改动路由/浮层时的自查清单。
   - `web/eslint.config.js` 新增 `no-restricted-syntax`，拦截 `window.history.*` 与裸 `history.*` 的**调用**。只读 `window.history.state` 不拦——`historyIndex()` 与根锚点需要它。已用 stdin 探针验证三条：`window.history.pushState(...)` 报错、`history.back()` 报错、`window.history.state` 只读通过；全量 lint 无新增违规。
   - `AGENTS.md` 新增「### 导航与路由」小节，指向该 guide。

## 完成标准（可验证）

> 勾选含义：`[x]` = **代码就位且通过静态检查**（typecheck / build / test / lint）。手势类行为一律以真机实测为准，未实测前不代表通过。

- [ ] 首页打开搜索 → 返回手势：搜索关闭，App 未退出（iOS 独立 PWA + Android 各验证一次）
- [ ] 列表 → 详情 → 灯箱 → 返回手势：仅关闭灯箱，详情页保持在位
- [ ] 创作抽屉 → 标签管理（两层）→ 返回手势：先关标签管理，再关创作抽屉
- [x] 设置 → 二级面板 → 返回手势：回到设置列表（移动端面板改 push、面板内返回改 `navigate(-1)`；桌面端保持 replace 同屏换面板）
- [x] 编辑器有内容 → 返回手势：弹出确认；选择取消则停留在编辑页且内容完整（代码就位，基于 Data Router useBlocker）
- [x] 冷启动直达 `/:type/:id` → 返回手势：回到首页，而非退出 App（`NavigationBootstrap` 根锚点）
- [ ] 从浮层内点进详情页 → 返回手势：不回到浮层（搜索框 / 通知面板 / 创作抽屉均已改为 replace，待实测）
- [ ] 页面返回按钮残留幽灵条目：详情/相册详情点返回按钮后再按返回手势，不重新进入刚离开的页面（`ArticleView` / `AlbumDetail` 已改 back）
- [x] AI 面板 → 历史 → 返回手势：先退历史，再退面板（`ai` / `ai-history` 两层）
- [ ] 灯箱：返回手势仅关闭灯箱、底层页面保持在位；连续切换照片不累积历史条目（切换是灯箱内部 state，全程不碰历史）；刷新后灯箱关闭（2026-09-12 由 URL 层改判为瞬时层）
- [ ] 灯箱：本轮三条活入口（正文单图 / 正文多图 / 相册详情）返回语义一致。实现仍是两套（`lib/lightbox.ts` 的 DOM `<dialog>` 与 `PhotoLightbox.tsx`），视觉与手势各自保留，本轮只统一**生命周期**（都由 layer 驱动）；AI 配图待其单独一轮落定后并入
- [x] 静态检查：灯箱的开关状态没有 `useState` 真相源 —— `LightboxHost` 与 `AlbumDetail` 的开关都来自 `useLayer`，`useState` 只承载"看第几张"
- [x] 瞬时层（搜索 / 通知面板 / 用户菜单 / 创作抽屉 / 安装指引 / AI 面板）：刷新后保持关闭 —— `NavigationBootstrap` 首帧 `replace` 剥离
- [ ] 创作抽屉：关闭后内容以草稿形式可恢复，不依赖抽屉自动重开
- [x] 静态检查：`window.history` 写操作已被 ESLint 拦截（`no-restricted-syntax`），仓库内零违规；只读 `state` 仅出现在 `NavigationBootstrap`
- [ ] 静态检查：浮层组件内 `useState` 形式的 open 状态为 0 —— 现存的是豁免名单里的锚定 popover（`AiModelPicker` 另有一处面板内下拉可选做）
- [x] `npm run typecheck` 通过 —— 注意：根 `typecheck` 是 `tsc --noEmit`，**不覆盖 `web/` 工作区**；前端类型闸门是 `npm run web:build`（内含 `tsc -b`）。改前端必须跑 `web:build`，只跑根 `typecheck` 会漏判
- [x] `npm run web:build` 通过（2026-09-11，PWA injectManifest 正常产出）
- [x] `npm test` 通过（52/52，含 `tests/layers.test.ts` 的嵌套、栈顶替换与 `historyIndex` 用例）
- [ ] `npm run web:lint` 通过 —— 现存 56 error / 6 warning 均为既有问题（含工作区大量未提交改动），阶段 2 各轮改动文件零新增；需另行清理

## 已知行为变更（需留意）

- **AI 面板不再跨路由存活**。面板的开关现在是当前历史条目的状态，用户导航到另一条路由时新条目不携带层，面板随之关闭。原先（`useState`）面板会跟着用户跨文章保留并按新上下文重置会话。移动端面板本就是模态、无法边开边导航，影响仅限桌面端非模态布局。若要恢复「常驻面板」，应作为一个显式特性（在导航后重新压层），而不是自动补层——自动补层会让返回手势无法关闭面板。
- `AiChatPanel` 的会话历史在上下文切换时不再显式重置，交由「路由变化即层消失」承担。
- **桌面锚定弹层也进栈**：`DatePicker` 在桌面是锚定 popover，改为层之后点开它会压入一条历史条目，浏览器 Back 由「离开页面」变为「关闭日期弹层」。这是刻意的——规则 3 要求按钮 / 遮罩 / `Esc` / 返回四条路径收敛为同一个 `navigate(-1)`，只在移动端进栈会派生出两套语义。外部点击关闭发生在 `pointerdown`、随后的链接导航发生在 `click`，两者之间有一次任务边界，`go(-1)` 会先完成，因此不会出现「弹层条目把新页面顶掉」。
- `open` / `close` / `replaceWith` 读取的是**最新一次渲染的 `location`**（`useLayer` 内部用 `locationRef` 在渲染期同步），所以即使在 `await` 之后调用，也不会压出基于过期层栈的条目。但**同一个 tick 内「先 `navigate(-1)` 再 `navigate(push)`」仍然不可靠**——`go(-1)` 是异步任务，`push` 会先落地、随后被这次回退弹掉，新层不出现。需要「关掉 A 直接换成 B」时用 `replaceWith`（`replaceTopLayer` + `replace: true`），层级深度不变。
- **灯箱不再进 URL，刷新后关闭**。原先计划用 `?photo=<assetId>`，2026-09-12 改判为 `lightbox` 层（理由见步骤 2）。直接后果：刷新或从历史里前进不会重新打开灯箱。这与其它瞬时层一致，也是 `NavigationBootstrap` 剥离 `layers` 的自然结果。另：切换照片是灯箱组件的内部 state，**不再需要规则 7 的 `replace`**——一次打开只占一条历史条目。
- **`openMultiImageLightbox` 在宿主未挂载时静默不做事**。宿主 `<LightboxHost/>` 挂在路由之外（`App.tsx`），实践中不会缺席；此处刻意不做"没宿主就退回命令式 DOM"的兜底，否则会重新长出一套不参与历史栈的灯箱。若未来要新增灯箱入口，先确认宿主仍在。
