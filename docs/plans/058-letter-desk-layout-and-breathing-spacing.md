# 信箱桌面布局与负空间呼吸感重构施工计划

> 创建：2026-09-11 · 
> 状态：已完成

## 目标

彻底解决信箱卡片“间距太近压迫”以及“CSS Grid 行高对齐导致的中间大面积死白断层”：
1. **消除整行死白空隙（下面的内容往上补）**：废弃 CSS Grid 整行强行对齐机制（当左卡片有图片而变高时，右卡片不会被强行撑开大面积空白），采用独立双列瀑布流（Dual-Column Masonry Flow），右侧后续卡片紧跟上一张卡片自然向上吸附补齐；
2. **空间呼吸感与负空间平衡**：列间距与卡片垂直间距统一接入 Orbit 间距规范（移动端 16px `var(--spacing-md)`，桌面端 24px `var(--spacing-lg)`），兼顾从容呼吸感与紧凑连贯；
3. **盒模型与叠层安全边界**：回信叠纸错位下移（`translateY(10px)`）完全由 `.orbit-letter-thread--has-replies` 容器内置消化，不破坏外部布局与负空间。

## 步骤

1. 改造 `web/src/pages/ArticleList.tsx`：
   - 接入时序分流双列流：首位新建卡占位、信件按时间倒序自然交替分配至左/右列；
   - 渲染 `.orbit-desk` 下的 `.orbit-desk-col` 独立列容器，使每列各自向下连续流动。
2. 改造 `web/src/index.css`：
   - `.orbit-desk` 与 `.orbit-desk-col` 采用 Flex 列流架构，间距响应式定义（移动端 1rem，桌面端 1.5rem）；
   - `.orbit-env` 优化内边距与字体排版，保持文字与封面的舒适阅读比；
   - `.orbit-letter-thread--has-replies` 保留 12px 底部安全间隙，彻底杜绝回信纸层穿透。
3. 验证构建与类型：
   - 运行 `npm run typecheck` 验证零类型错误；
   - 运行 `npm --prefix web run build` 验证构建通过；
   - 运行 `npm test` 验证全站测试全部通过。

## 完成标准（可验证）

- [x] 左右列卡片高度不同时（如含手写信照片），下方卡片自然向上补齐，无大面积死白断层；
- [x] 卡片间距在移动端（16px）与桌面端（24px）舒适通透，无压迫与粘连；
- [x] 回信叠放纸层完全自洽于盒模型内，不侵蚀外部卡片间距；
- [x] `npm run typecheck` 零错误；
- [x] `npm --prefix web run build` 构建成功；
- [x] `npm test` 51 项测试全部通过。
