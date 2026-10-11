# Tab 切换重新加载与详情页返回闪烁

> 创建：2026-09-24 · 状态：已修复

## 现象

1. **Tab 切换重新加载与状态丢失**：用户在底栏或侧边栏切换「动态」、「相册」、「信箱」、「我们」时，每次都像全新刷新一样重新挂载页面组件，滚动条被强行清零，已展开状态和筛选条件丢失，短时间内发生重复网络请求。
2. **详情页返回严重闪烁与弹跳**：在动态或信箱中点击某篇内容查看详情，再点击返回时，页面先在顶部闪现曝光，随后突兀弹跳至先前的滚动位置，伴随顶部状态栏与底栏的剧烈插入抖动。

## 期望行为

- **Tab 间无缝即时切换**：各核心 Tab 之间切换应零延迟、零重复网络请求，保持每个 Tab 各自的浏览位置与界面状态；
- **详情页返回零闪烁**：从详情页返回主列表时，底层视图自然呈现，滚动位置丝毫不动，无骨架突变与二次弹跳；
- **缓存策略符合业务第一性原理**：针对私密双人空间特性，数据已由写操作（Mutation）精准失效，主列表读取应享受长效本地缓存，避免频繁空耗网络。

## 根因分析（第一性原理）

1. **共享单容器与互斥卸载冲突（架构根源）**：
   - 当前在 `App.tsx` 中把四个主 Tab 全部声明为 `<Outlet />` 的对等互斥路由；
   - 切换 Tab 时，前一个 Tab 的整个组件树被彻底卸载（Unmount），所有 DOM 节点与图片布局被销毁；切回时又从头挂载（Mount）；
   - 在 `MobileShell` 与 `DesktopShell` 中，全站所有页面共享同一个全局 `<main>` 作为滚动容器。Tab 切换时为防止旧页面滚动偏置残留，路由拦截层强制执行了 `scrollTop = 0`。
2. **滚动恢复二段式跳动的时序差**：
   - 列表页因进入详情被卸载，返回时 React 从头生成 DOM；
   - 在首帧同步执行 `scrollTop = saved` 时，子组件布局与图片排版尚未撑开完整高度，浏览器原生截断至当时的最大高度（甚至归零）；
   - 紧接着 `ResizeObserver` 监听到高度就绪，在后一帧突兀将滚动偏置拉回目标位置，导致视觉上“先闪现顶部、再暴跳到底部”。
3. **沉浸式外壳切换的视口剧变 (CLS)**：
   - 详情页启用了 `isImmersive`，完全移除了移动端 Header 与 TabBar；返回列表页时 Header 与 TabBar 瞬间插入 DOM，使 `<main>` 的视口高度和安全内边距发生瞬时突变。
4. **短时失效与失焦重复拉取**：
   - 全局 `staleTime` 仅 60 秒且开启了 `refetchOnWindowFocus`，离开页面超 1 分钟或切窗口即判定数据失效，触发多余的后台全量接口请求。

## 第一性原理修复设计

1. **主 Tab 视图容器保活（Tab Keep-Alive Host）**：
   - 将四个主 Tab（`/`、`/albums`、`/letter`、`/us`）提升为主内容区的持久视图层，首次访问时按需懒加载挂载，之后保持在 DOM 树中；
   - 切换 Tab 时仅切换显隐状态（通过 `visibility: hidden` 与 `content-visibility: hidden` 保持排版状态与滚动偏置），不销毁组件树；
2. **原生独立滚动视口（Isolated Native Viewports）**：
   - 各 Tab 拥有专属独立的滚动容器，其 `scrollTop` 由浏览器引擎原生持久保留，无需任何 JS 轮询、写 Store 或是 `ResizeObserver` 校准；
3. **子页面独立栈式层级**：
   - 详情页、编辑页、设置等子路由通过专用的子页面视图层挂载；子页面退出时，底层主 Tab 自然显露，零 DOM 重建、零高度重算、零闪烁；
4. **缓存合理化**：
   - 全局 `staleTime` 设定为 5 分钟，关闭失焦自动全量刷新（`refetchOnWindowFocus: false`），由既有的写操作 `invalidateQueries` 驱动精准数据更新。

## 回归验证

- [x] `web/src/components/layout/TabKeepAliveHost.tsx` 实现原生滚动视口隔离与 Tab 视图保活，DOM 及 `scrollTop` 100% 保持；
- [x] `DesktopShell.tsx` 与 `MobileShell.tsx` 全面接入 `TabKeepAliveHost`，主 Tab 间切换及详情页返回零闪烁、零白屏、零二次弹跳；
- [x] `TabBar.tsx` 与 `DesktopShell.tsx` 支持在当前活跃 Tab 再次点击时平滑滚动至顶部；
- [x] `web/src/lib/queryClient.ts` 调整全局 `staleTime: 5 * 60_000` 并禁用 `refetchOnWindowFocus`；
- [x] ESLint 静态代码检查针对改动文件 0 错误 0 警告；
- [x] 前端构建类型闸门 `npm run web:build`（包含 `tsc -b` 与 Vite 构建）0 错误成功构建通过；
- [x] 全局回归测试 `npm test` 60/60 测试用例全部通过；
- [x] `npm run typecheck` 0 错误通过。
