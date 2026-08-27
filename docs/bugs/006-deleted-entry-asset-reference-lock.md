# 引用图片内容删除后仍显示关联且无法删除图片

> 创建：2026-08-26 · 
> 状态：已修复

## 现象

用户在日记中插入图片后，将相关日记全部删除。相册中该图片依然显示为「已关联」，并在图片详情中展示引用来源为「日记 · 标题 已删除」，且无法进行删除操作（前端无删除按钮，后端也拦截报错）。

## 期望行为

- 当引用某图片的所有内容均被删除后，该图片应自动被判定为「未关联」。
- 图片详情中不应展示已删除的条目。
- 详情弹窗中应正常展示「删除图片」按钮，用户点击后可安全彻底删除该图片。

## 根因与修复

1. **根因**：
   - 内容软删除（`entry.deleted_at` 标记）时未清理 `asset_reference` 引用关系。
   - 相册原设计保留了软删除内容的引用并标记「已删除」，导致统计时 `linked` 仍为真。
   - 相册删除保护要求必须是「未关联」图片才可删除，导致图片陷入永久无法解绑、无法删除的死锁。

2. **修复措施**：
   - 在内容删除路径（`src/api/articles.ts` 和 `src/services/content/content-write.ts`）中增加解绑逻辑 `clearAssetReferencesForSource`。
   - `backfillAssetReferences` 全量同步时过滤 `entry.deleted_at is null`，并通过升级 backfill key 自动清理历史脏引用。
   - 相册查询 `linkedExists` 与 `loadSourcesForKeys` 仅统计未软删除的有效条目，双重兜底。

## 回归验证

- `npm run typecheck`
- `npm run web:build`
