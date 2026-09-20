# 单草稿工作区模型重构（废除草稿箱入口）

> 创建：2026-09-08 · 
> 状态：已完成

## 目标

从第一性原理彻底移除编辑页常驻的草稿箱图标与侧边抽屉，确立每个用户每个分类（动态/信件）仅维护 1 篇最新草稿的单工作区断点机制，零胶水代码，遵循端到端最佳实践。

## 步骤

1. **后端原子收敛**（`src/api/articles.ts`）：
   - `POST /api/articles` 存草稿时就地原子更新已有草稿，确保单草稿；
   - `GET /api/articles?status=draft` 查询数量限制为 1。
2. **废弃组件物理删除**：
   - 删除 `web/src/components/DraftDrawer.tsx`；
   - 清理 `web/src/index.css` 中废弃的抽屉与红点徽标样式。
3. **编辑页交互与视觉重塑**（`web/src/pages/ArticleEdit.tsx`）：
   - 彻底移除顶栏草稿箱图标、徽标及二次确认弹窗，顶栏仅保留 `←` 与主 CTA；
   - 新增极简按需恢复微条幅（`DraftRestoreBanner`），支持一键恢复与丢弃；
   - 退出拦截保留自然存草稿能力。
4. **端到端验证与收尾**：
   - 编写 `tests/draft-buffer-api.test.ts` 覆盖创建、原子覆盖更新、丢弃删除完整生命周期；
   - 运行 `typecheck`、`web:build` 与全量单元测试（37 项测试全通过）。

## 完成标准（可验证）

- [x] `npm run typecheck` 零错误通过
- [x] `npm run web:build` 全量构建通过
- [x] 编辑页顶栏右侧仅保留唯一主 CTA，彻底无草稿箱图标与徽标
- [x] 在 `/moment/new` 输入内容退出选保存，重新进入新建页可看到轻量恢复条幅
- [x] 点击 [恢复] 正确还原草稿，点击 [丢弃] 物理删除草稿且提示消失
- [x] `/letter/new` 与 `/moment/new` 草稿严格按路由类型隔离，互不干扰
