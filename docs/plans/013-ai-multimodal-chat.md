# 013: AI 聊天多模态与图片上传支持

> 关联：[docs/features/018-ai-multimodal-chat.md](../features/018-ai-multimodal-chat.md) · 状态：已完成

## 目标

为 Orbit AI 对话接入标准多模态图片上传与识别能力，保证业务相册与 AI 临时文件完全隔离。

## 关键任务

- [x] 服务端：实现 `POST /api/ai/upload` 与 `/ai-attachments/*` 静态资源代理（Node & Worker 双模式）
- [x] 服务端：在 `ai-chat-store.ts` 适配 `partsToPreview` 列表摘要与 `compressMessagesForModel` 多模态 Token 预算与历史退化
- [x] 服务端：在 `ai-chat-runtime.ts` 适配本地环境图片转 Base64 供外网模型直接读取
- [x] 前端：封装 `uploadAiAttachment` API 客户端
- [x] 前端：`AiChatPanel.tsx` 增加附件按钮、`onPaste` 截图粘贴、拖拽、微型缩略卡片栏与气泡大图预览
- [x] 验证：`npm run typecheck`、`npm run web:lint` 与生产构建验证完成

## 验收标准

1. 截图直接 `Cmd+V` 粘贴到 AI 输入框能正常上传与预览；
2. 选择 Qwen 3.7 Plus / GLM 4.7 Flash 模型能够正确解析图片内容；
3. 相册 `/gallery` 保持完全纯净，不含任何聊天临时图片；
4. 构建与类型检查全部通过。
