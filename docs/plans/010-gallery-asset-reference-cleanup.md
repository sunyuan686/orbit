# 相册图片引用解绑与删除死锁修复

> 创建：2026-08-26 · 
> 状态：已完成

## 目标

解除因已软删除内容导致的图片关联死锁，使引用内容全被删除的图片自动恢复为「未关联」，并允许用户安全删除。

## 步骤

1. 在 `src/services/content/asset-references.ts` 中增加 `clearAssetReferencesForSource`，修改 `backfillAssetReferences` 仅检索未删除条目，并升级回填标识至 `v2`。
2. 在 `src/api/articles.ts` 和 `src/services/content/content-write.ts` 的删除操作中同步调用解绑函数。
3. 在 `src/services/content/gallery.ts` 中增强关联查询与有效来源过滤（双重兜底，仅统计未删除条目）。
4. 更新 `docs/features/005-gallery.md` 与记录 `docs/bugs/006-deleted-entry-asset-reference-lock.md`。
5. 运行类型检查与构建打包验证闭环。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 通过
- [x] 存量及新增软删除内容不再占用 `asset_reference`
- [x] 相册对仅被软删除内容引用的图片正确识别为未关联并允许删除
