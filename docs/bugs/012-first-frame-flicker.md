# 生产模式首页启动闪烁

> 创建：2026-09-01 ·
> 状态：已修复

## 现象

- 生产环境冷启动时，首页画面出现多次明暗/布局跳变（启动屏动画重播、闪白、字体后到引起的排版跳变）。
- 开发环境因无 Service Worker 且 chunk 本地加载，症状较轻但同样存在动画重播。

## 期望行为

- 冷启动全程视觉连续：启动屏淡入一次 → 首个有效帧就绪 → 启动屏淡出，中途无任何 DOM 卸载重建或颜色跳变。
- 首帧颜色与用户外观偏好（主题/画布底色/强调色）完全一致。

## 根因与修复

被违反的不变量：**首帧视觉状态必须有唯一 owner，且在第一次绘制之前确定**。原实现中所有权分裂在三处：

1. **启动屏 DOM 被三个阶段分别持有**：`index.html` 内联启动屏 → `Suspense fallback`（AppBootScreen）→ `RequireAuth` isPending（再次渲染 AppBootScreen）。每次阶段交接都是 DOM 销毁重建，`orbit-boot-in` 动画（`opacity:0` 起步、0.15s 延迟）从零重播，视觉上闪烁多次。
2. **外观状态活在 React 运行时**：theme/bg/accent/fontMode/fontSize 由 `useTheme` 的 `useEffect` 与 `main.tsx` 的 `initAppearancePreferences()` 在 React 挂载后才应用，而首帧绘制发生在 React 之前；且 `index.html` 启动屏颜色硬编码 `#fafaf9`（dark 借助媒体查询近似，其余 bg/accent 完全不跟随）——首帧与最终态必然存在色差跳变。
3. **字体全部依赖 Google Fonts CDN**（render-blocking stylesheet）：大陆网络不可达时首绘被阻塞直至超时；可达时 `display=swap` 又造成字体后到的排版跳变；离线（PWA 场景）时字体全丢。

修复（`web/`）：

| 文件 | 变更 |
|---|---|
| `index.html` | head 顶部新增内联同步脚本：任何绘制前读 localStorage 写入 `.dark` class、`data-accent/bg/font-mode/font-size`、`--grain-opacity`（首帧唯一写入点，键名与 `accent.ts`/`useTheme.ts` 一致）。启动屏移至 `#root` 之外成为唯一 DOM 实例，颜色全部改引 Design Tokens 变量（`var(--color-bg, …)`），删除 dark 媒体查询重复块，新增 `orbit-boot--leave` 淡出动画 |
| `src/lib/bootScreen.ts` | 新增：`dismissBootScreen()` 幂等淡出并移除启动屏（`prefers-reduced-motion` 直接移除） |
| `src/components/RequireAuth.tsx` | isPending 返回 `null`（启动屏仍在最上层覆盖）；会话校验完成后调用 `dismissBootScreen()` |
| `src/pages/Login.tsx` / `Join.tsx` | 挂载后调用 `dismissBootScreen()`（此二路由在 RequireAuth 之外） |
| `src/App.tsx` | `Suspense fallback` 改为 `null`；删除 `AppBootScreen` 引用 |
| `src/components/AppBootScreen.tsx` | 删除 |
| `src/fonts.css`（新增）+ `public/fonts/`（19 个 woff2） | Inter 400/500/600、JetBrains Mono 400/500、Source Serif 4（variable 500-600）自托管，保留 unicode-range 分片；woff2 进入 SW 预缓存（vite-plugin-pwa `globPatterns` 已含 `**/*.woff2`） |
| `index.html` 字体引入 | 移除 render-blocking 的 `fonts.googleapis.com` stylesheet；Noto Serif SC（中文回退，标题栈中位于本地宋体之后）改为非阻塞加载（`media="print"` onload 切换） |

未在本次处理（独立问题）：生产环境 PWA 自动整页 reload 待定（更新契约属另一个 bug，确认现象后另行记录）；首页数据到达后的逐段插入（内容加载感，非闪烁）。

## 回归验证

- `npm run typecheck` ✅
- `npm run web:build` ✅（19 个 woff2 均进入 SW precache；`dist/index.html` 确认内联脚本、boot 层唯一实例、googleapis 仅剩非阻塞 link）
- `npm run web:lint` 与修改前基线一致（零新增）
- 手动验证（需部署后）：
  1. 浅色/深色/自定义画布底色下冷启动，启动屏颜色应与最终页面底色一致，无闪白
  2. 启动屏动画全程只播放一次（含登录态跳转 /login 场景）
  3. 断网（离线 PWA）冷启动，字体正常（拉丁字体来自本地缓存）
