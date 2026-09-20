# 信箱滑到底部无触底提示与状态反馈

> 创建：2026-09-06 · 
> 状态：已修复

## 现象

在信箱（`/letter`）页面滑到底部时，最后一封信件卡片直接紧贴着屏幕底部的导航栏，没有任何触底提示（如动态页面的 `· 已经看到最后了 ·`），缺少阅读留白和边界反馈，导致用户无法判断是尚未加载完成、网络卡顿还是已看完全部内容，交互体验不完整。

## 期望行为

- 信箱页面滑动到底部后，具备统一舒适的底部留白安全区；
- 底部正常展示设计系统标准的 `· 已经看到最后了 ·` 终点底线提示；
- 列表底部状态反馈逻辑统一组件化，杜绝在各页面编写假参数/兼容胶水代码。

## 根因与修复

- **根因**：
  1. `<InfiniteScrollSentinel />` 组件将 `sentinelRef` 和 `isFetchingNextPage` 设为了必填，强假设所有列表都走“分页无限滚动 Hook”，无法自然复用于信箱这种“全量一次性拉取并组装树结构”的非分页列表；
  2. `web/src/pages/ArticleList.tsx` 在 JSX 分支中将 `isLetter` 与普通列表互斥割裂，且把 `<InfiniteScrollSentinel />` 硬编码在 `!isLetter` 分支内；
  3. 各页面（`Home.tsx`、`Gallery.tsx` 等）重复硬编码传递默认文案 `endMessage="· 已经看到最后了 ·"`，存在代码冗余与维护成本。

- **修复**：
  1. **组件解耦通用化**（`web/src/components/ui/InfiniteScrollSentinel.tsx`）：
     - 将 `sentinelRef` 与 `isFetchingNextPage` 调整为可选（缺省为 `false` / 无哨兵挂载）；
     - 统一支持“增量分页列表”与“全量静态列表”两种场景，全量列表只需传入列表长度与可选的重试回调，即可开箱即用；
     - 当加载失败时自动展示温和的“加载失败，点击重试”按钮，加载完成且无错误时自动展示 `· 已经看到最后了 ·`。
  2. **消除页面结构割裂与胶水代码**（`web/src/pages/ArticleList.tsx`）：
     - 内容区按需渲染信箱网格（`orbit-desk`）或普通文章列表（`TypedEntryList`）；
     - 列表底部在同层级统一挂接 `<InfiniteScrollSentinel />`，信箱自然享有统一的触底提示、错误重试与安全留白。
  3. **清理冗余参数**（`web/src/pages/Home.tsx`、`web/src/pages/Gallery.tsx`）：
     - 移除多处重复硬编码的 `endMessage` 传参，由组件默认值统一收敛。

## 回归验证

- `web` 模块运行 `npm run build`（`tsc -b && vite build`）通过，无类型与打包异常；
- 信箱列表在加载完毕后正常居中显示 `· 已经看到最后了 ·`，且底部拥有良好的阅读视距留白。
