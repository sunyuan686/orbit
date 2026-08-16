# 录音转写文稿可编辑化改造

> 创建：2026-08-15 · 
> 状态：已完成

## 目标

从第一性原理出发，将录音转写文稿（transcript）从只读状态升级为可校对、可补录的用户语义资产，在发帖前附件栏与发帖后富文本编辑器中提供无缝的文稿编辑闭环。

## 步骤

1. 在 `web/src/extensions/OrbitAudio.ts` 中实现 `AudioNodeView`，支持编辑态文稿内联修改、空文稿手动补录与 ProseMirror 属性（`data-transcript`）事务同步。
2. 在 `web/src/components/MediaAttachmentsBar.tsx` 中增加文稿编辑与手动补录交互，暴露 `onUpdateTranscript` 回调。
3. 在 `web/src/components/ComposeModal.tsx` 和 `web/src/components/TiptapEditor.tsx` 中接入 `onUpdateTranscript`。
4. 运行 `npm run build` / typecheck 校验代码正确性与前后兼容性。

## 完成标准（可验证）

- [x] 类型检查与构建通过：`npm run build` 无错误。
- [x] 随想弹窗发帖前：录音后展开文稿可编辑修改，修改后提交正文包含更新后的文稿内容。
- [x] 富文本编辑器内：文章详情页点击“编辑”后，编辑器内的音频卡片可展开并直接编辑文稿，保存后自动同步到正文 HTML 和后端搜索索引。
