# 语音转写文稿在Web端与移动端无法编辑

> 创建：2026-09-10 · 
> 状态：已修复

## 现象

用户在移动端与Web端使用语音功能时，转写文稿（Transcript）无法被编辑：
1. **详情页（阅读态）**：打开包含录音的动态或日记，展开语音卡片的「文稿」后，下方显示了一个「编辑」按钮，但在Web端点击或移动端轻触毫无反应，形成死按钮。
2. **移动端发帖抽屉（`QuickComposeSheet`）**：使用底部抽屉录音后，附件预览栏的录音卡片未提供编辑文稿入口，发帖前无法校正转写文字。
3. **Web首页随想录入框（`MomentQuickComposer`）**：在首页第一格录音后，附件预览栏同样未提供编辑文稿入口。

## 根因分析（第一性原理）

录音转写文稿（Transcript）是伴随音频的高噪人类语义资产，ASR 识别天然存在同音字和环境噪音误差，全生命周期中「可查看、可校对、可持久化」是核心闭环。现有架构存在两处设计与实现割裂：

1. **`OrbitAudio.ts` 交互实现与只读态拦截**：
   `AudioNodeView` 内部已构建内联编辑表单（textarea、完成、取消按钮），并在 DOM 挂载时无条件渲染了「编辑」按钮。然而 `startEditing()` 仅做了 `if (!this.editor.isEditable) return;` 阻断。在详情页（`<TiptapEditor readonly />`）中，该按钮变成无法响应的幽灵按钮，且缺乏原地提交后端持久化的通道。
2. **快速发布组件漏传回调接口**：
   `QuickComposeSheet.tsx` 与 `MomentQuickComposer.tsx` 在使用 `<MediaAttachmentsBar />` 时均未向其传递 `onUpdateTranscript`，导致组件内部直接将编辑入口隐藏。

## 解决方案

1. **`OrbitAudio.ts` 赋能就地校对与权限守卫**：
   - 扩展 `AudioOptions`，支持 `canEdit?: boolean` 权限标识与 `onSaveTranscript?: (newTranscript: string) => Promise<void>` 持久化回调。
   - 权限控制：拥有编辑权限（`canEdit` 或 `editor.isEditable`）时展示「编辑」按钮；无权访客彻底隐藏编辑按钮。
   - 双模持久化：编辑器模式下通过 ProseMirror 事务更新节点属性；只读详情页模式下通过 `onSaveTranscript` 提交持久化，原地完成更新并退出编辑态。
2. **`TiptapEditor.tsx` 与 `ArticleView.tsx` 贯通**：
   - `ArticleView` 基于 `canEditEntry` 将作者编辑权限传递给编辑器，并实现 `onUpdateAudioTranscript` 回调，就地调用 `saveEntry` 更新正文 HTML 并刷新查询缓存。
3. **发布前预览栏全端补齐**：
   - `QuickComposeSheet.tsx`（移动端）与 `MomentQuickComposer.tsx`（Web端）补齐 `onUpdateTranscript` 处理函数，打通发帖前的校正闭环。
4. **CSS 规范对齐**：
   - 补齐 `.orbit-voice-cancel-btn` 样式类，保证视觉规范一致。

## 回归验证

- 类型检查：`npm run typecheck` 零错误。
- 前端构建：`npm run build --prefix web` 零错误。
- 详情页验证：作者查看可点击「编辑」，修改后点击「完成」，即时保存且文稿刷新；访客无编辑按钮。
- 发帖前验证：移动端抽屉与Web首页随想输入框录音后，文稿均可正常编辑与更新。
