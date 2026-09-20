# 统一系统图标维护规范

> 创建：2026-09-08 · 
> 状态：已完成

## 目标

从第一性原理出发，将全站分散在各个业务组件中的内联硬编码 `<svg>` 彻底收归到 `web/src/components/OrbitIcons.tsx` 统一维护，消除 1.8/2.0/2.5 描边错乱与重复造轮子，不写任何胶水代码。

## 步骤

1. 在 `web/src/components/OrbitIcons.tsx` 补齐 7 个基础图标（`MicIcon`, `TitleIcon`, `UploadIcon`, `MinimizeIcon`, `LoadingIcon`, `PlayIcon`, `PauseIcon`）；
2. 替换已有图标的重复内联实现：
   - `ArticleList.tsx`（信件卡片图标 -> `LetterIcon`）
   - `DraftDrawer.tsx`（删除状态打勾、垃圾桶、loading -> `CheckIcon`, `TrashIcon`, `LoadingIcon`）
   - `MultiImageDeck.tsx`（翻页箭头与角标 -> `ChevronLeftIcon`, `ChevronRightIcon`, `GalleryIcon`）
   - `MediaAttachmentsBar.tsx`（播放/暂停、删除叉号 -> `PlayIcon`, `PauseIcon`, `CloseIcon`）
   - `SwUpdatePrompt.tsx`（关闭叉号 -> `CloseIcon`）
3. 替换新增系统图标的内联实现：
   - `VoiceInputButton.tsx`（麦克风 -> `MicIcon`）
   - `UsMenuSheet.tsx`（数据导入导出 -> `UploadIcon`）
   - `ComposeModal.tsx`（全屏与标题 -> `ExpandIcon`, `TitleIcon`）
   - `TiptapEditor.tsx`（图片、标题、全屏 -> `GalleryIcon`, `TitleIcon`, `ExpandIcon`）
   - `EditorFullscreenOverlay.tsx`（退出全屏 -> `MinimizeIcon`）
4. 全局构建、类型检查与代码检查验证。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过
- [x] `npm run web:build` 通过
- [x] `npm run test` 通过
- [x] grep 验证上述组件中冗余内联 `<svg>` 全部清空
