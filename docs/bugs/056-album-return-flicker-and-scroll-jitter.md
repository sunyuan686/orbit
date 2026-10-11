# 全站次级页面返回零闪动与滚动精准恢复 (第一性原理)

> 创建：2026-10-08 · 状态：已修复

## 现象

用户在相册详情（`/albums/:id`）、文章详情（`/:type/:id`）、搜索页（`/search`）、记忆星图（`/memories`）等次级页面间流转跳转，随后通过系统返回手势或界面返回按钮回到前一页面时，出现不同程度的画面瞬间闪动（白屏/黑块/占位动画重现/“加载中”闪现）或滚动位置拉扯抖动。

## 期望行为

- **全站所有界面返回零闪动**：任何页面挂载首帧一次性完成稳定渲染，无微任务级二次虚拟 DOM Diff 重绘，无大面积图片占位重淡入动画，无缓存就绪下的空数据态/加载提示（“搜索中…”、“点亮星图中…”）闪现。
- **已载入图片首帧同步直出**：会话内已浏览过的图片在页面重建时立即从内存位图同步解码渲染，无 WebKit 异步解码真空期造成的透明底色频闪。
- **滚动偏置精准对称恢复**：返回前页时首帧平滑恢复至离开前的物理偏置，无向上或向下拉扯跳动；若此前在顶部未滑动，平滑归零，不残留文章页滑动偏置。
- **外壳视口几何恒定**：全端次级页面间切换时外壳高度恒定，无顶部导航栏突兀插入造成的 CLS 布局偏移。

## 根因分析与全站第一性原理修复

### 1. 图像状态机冷热双态闭环（`GalleryImage.tsx` & `MultiImageDeck.tsx`）
- **根因**：React 隐藏了占位骨架，但 WebKit 因 `loading="lazy"` 与 `decoding="async"` 在首帧排版时直接将 `<img>` 绘制为完全透明，导致视口内瞬间露出暗灰底色（`bg-[var(--color-surface-raised)]`），持续约 70ms 直至异步解码完成才逐行弹入图片，产生强烈的频闪。
- **解法**：基于单一会话集合 `loadedSrcCache`，热态图片（会话内已载入）切换为 `loading="eager"` + `decoding="sync"`，跳过浏览器的 Intersection 视口排队检测，在首帧布局/绘制时同步解码渲染内存位图，彻底消除透明空方块真空期；冷态继续保持 `"lazy"` 与 `"async"`。

### 2. 次级页面数据流单一真相源（TanStack Query 原生缓存）
- **根因**：
  - 此前全站只有 `Search.tsx` 使用了孤立的局部 `useState([]) + useEffect(fetchSearch)`，页面卸载重建后状态丢失，导致返回搜索页时短暂闪现“未找到内容”；
  - `AlbumDetail.tsx` 中挂载 `useEffect` 无条件调用 `setEditTitle` 与 `setEditDesc`，在组件首帧挂载完成后触发了不必要的全量二次虚拟 DOM Diff；
  - （辨析）TanStack Query 本身在组件第 0 帧即可通过 `useSyncExternalStore` 同步返回有效期内的缓存数据（全局 `staleTime: 5min`），无需也严禁在业务层书写 `initialData: () => queryClient.getQueryData(key)` 这种循环查寻的冗余胶水代码。
- **解法**：
  - 将 `Search.tsx` 迁移为标准的 `useQuery({ queryKey: queryKeys.search(q), queryFn: fetchSearch })`，返回时首帧直接从 QueryCache 命中上次搜索结果；
  - 清理 `AlbumDetail.tsx` 的挂载副作用，表单状态仅在点击“编辑”按钮时惰性初始化；
  - 拒绝过度防御性补丁，保持各页面 `useQuery` 直白干净。

### 3. 全局路由 Chunk 空闲预加载（`App.tsx`）
- **根因**：代码分割（`lazy()`）在首次进入未访问过的子页面类型时存在网络拉取延迟，触发 Suspense fallback。
- **解法**：在 `RootShell` 的 `requestIdleCallback` 中预拉取所有次级页面 Chunk（`ArticleList`, `ArticleEdit`, `Memories`, `Search`, `Settings` 等），消除后续导航或侧滑返回时的网络拉取悬停。

### 4. 滚动偏置单一真相源恢复（`useScrollRestoration.ts`）
- **根因**：POP 导航判定此前缺失归零对称逻辑；且连续 12 帧 RAF 盲目轮询造成页面上下抽搐。
- **解法**：POP 返回时将目标收敛为 `const target = saved ?? 0`，首帧 `useLayoutEffect` 同步归位；废弃连续盲目轮询，改由单一 `ResizeObserver` / DOM 变动在实际高度扩展时单次对齐。

### 5. 沉浸式外壳全路由几何恒定（`DesktopShell.tsx` & `MobileShell.tsx`）
- **根因**：路由判定遗漏导致部分次级页面间切换时导航栏忽现忽隐，触发视口尺寸突变。
- **解法**：统一次级详情路由与编辑路由的沉浸判定，视口几何尺寸绝对恒定。

## 回归验证

- [x] `GalleryImage.tsx` 与 `MultiImageDeck.tsx` 热态图片同步解码直出，消除 WebKit 异步解码真空期灰块；
- [x] `AlbumDetail.tsx` 消除首帧二次渲染副作用；
- [x] `Search.tsx` 接入 React Query，搜索结果返回首帧稳定保留，无闪现；
- [x] 全站次级页面 `useQuery` 直白简洁，无多余 `initialData` 胶水代码，原生利用 5 分钟 QueryCache 同步直出；
- [x] `useScrollRestoration.ts` POP 恢复逻辑更新并经单元测试验证（`npm test` 60/60 全部通过）；
- [x] 全局空闲预加载所有路由 Chunk，消除 Suspense 空白；
- [x] 全局构建与类型检查通过：`npm run web:build`、`npm test`。
