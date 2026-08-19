# 统一多媒体处理与渲染体系

> 创建：2026-08-16 · 
> 状态：已完成

## 目标

从第一性原理重构前端多媒体（图片、视频、音频）从上传、编辑器附件管理、TipTap 节点插入、HTML 序列化到详情渲染的全链路，消除字段断层与类型硬编码，提供统一可信的媒体类型推导与渲染规范。

## 核心设计与步骤

1. **统一媒体类型单一可信源**（`web/src/lib/content.ts`）：
   - 提供统一的 `resolveMediaType(item: { mimeType?: string; url?: string; file?: File }): "image" | "video" | "audio"`。
   - 统一判定规则（MIME 前缀优先，URL 扩展名兜底），杜绝各组件独立猜测或漏字段导致判定失效。

2. **重构编辑器媒体上传与数据模型**（`web/src/components/TiptapEditor.tsx`）：
   - 重命名并重构 `handleImageUpload` -> `handleMediaUpload`。
   - Note 模式：完整透传 `uploadAsset` 返回的全部元数据（`mimeType`, `width`, `height`, `duration`, `transcript`），解决元数据丢失问题。
   - Article 模式：根据媒体类型（图片 / 视频 / 音频）分别调用 TipTap 的 `setImage` / `setVideo`，支持直接在长文中插入视频。

3. **优化附件栏渲染与预览**（`web/src/components/MediaAttachmentsBar.tsx`）：
   - 使用统一的媒体类型判定，为视频附件提供优雅的视频预览与标记，解决显示破损图片的问题。

4. **规范化正文与附件序列化**（`web/src/lib/content.ts`）：
   - 统一 `combineHtmlAndAttachments` 基于 `resolveMediaType` 输出标准的 `<video>`、`<audio>` 与 `<img>`。

## 完成标准（可验证）

- [x] `npm --prefix web run build` 与 `npm run typecheck` 通过，无类型错误。
- [x] 随想/日记模式下上传视频，左下角附件栏正确显示视频预览（而非破损图片）。
- [x] 保存随想/日记后，详情页能够正常渲染并播放视频组件。
- [x] 长文章模式下插入视频也能正确插入 `<video>` 节点。
