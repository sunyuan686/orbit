# Tiptap 富文本长文模式拖拽粘贴或上传音频缺失分支导致生成损坏图片

> 创建：2026-09-11 · 
> 状态：已解决

## 现象

在长文模式（`ArticleEdit`）下，向编辑器拖拽、粘贴或从文件选择器选择音频文件（如 `.mp3`, `.m4a`, `.wav` 等）时，编辑器未将其作为音频卡片渲染，而是错误插入了带有音频链接的 `<img>` 标签，导致界面出现裂图破损。

## 期望行为

在富文本长文模式下拖入、粘贴或上传音频文件时，能正常上传并调用 `setAudio` 插入结构化语音卡片，若后端返回了自动转写的 `transcript` 则一并带入。

## 根因与修复

- **根因**：
  `web/src/components/TiptapEditor.tsx` 中，剪贴板（`handlePaste`）、拖放（`handleDrop`）及隐藏文件输入框（`<input accept="image/*,video/*,audio/*">`）均已声明支持音频类型，并统一转发至 `uploadMediaToEditor`。但 `uploadMediaToEditor` 仅拦截了 `mediaType === "video"`，缺失 `mediaType === "audio"` 分支，导致音频文件落入兜底的 `setImage` 逻辑。
- **修复方案**：
  在 `uploadMediaToEditor` 中补充 `if (mediaType === "audio")` 分支，上传音频成功后调用 `ed.chain().focus().setAudio({ src: res.url, transcript: res.transcript ?? undefined }).run()` 插入规范的语音节点。

## 回归验证

- [x] 补齐 `mediaType === "audio"` 分支
- [x] 前端类型检查与构建通过 (`npm run web:build`)
- [x] 单测套件与类型检查全量通过 (`npm run typecheck && npm test` 47项全过)
