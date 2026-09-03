# 全局导航与操作图标光学比例及线宽统一规范

> 创建：2026-09-03 · 
> 状态：已修复

## 现象

1. **侧边栏导航图标偏大**：主导航项左侧图标硬编码为 20px，面对 13px 汉字标签视觉体量达到近 3 倍，产生严重层级倒挂和拥挤感。
2. **侧边栏顶部自身不一致**：展开态的折叠按钮为 16px，但折叠态的展开按钮以及移动端关闭按钮为 20px。
3. **移动端抽屉关闭按钮不统一**：目录抽屉（TOC）与边注抽屉（Marginalia）关闭图标为 20px，草稿箱抽屉硬编码 2.0 粗线宽，与全站其他关闭按钮（16px + 1.5 细线宽）不一致。
4. **发帖浮层工具栏尺寸与线宽割裂**：底部工具按钮图标忽大（18px）忽小（15px），且均内联了 2.0 粗描边，与全局克制文学刊物风相违背。

## 期望行为

- 遵循 [DESIGN.md](../../DESIGN.md) “30% 墨水排版骨架”与克制留白原则，所有行内与工具按钮图标统一收敛至标准 16px，描边统一为细腻克制的 `strokeWidth={1.5}`。
- 侧边栏所有操作图标、抽屉关闭图标以及发帖工具栏图标保持 100% 一致的光学规格与交互手感。

## 根因与修复

1. **统一侧边栏导航与控制图标**：
   - `web/src/components/OrbitIcons.tsx`：将 `ICON_PX.nav` 从 `20` 调整为 `16`。
   - `web/src/components/Layout.tsx`：将折叠态 `<SidebarExpandIcon>` 和移动端 `<CloseIcon>` 从 `size="md"` 统一为 `size="sm"`（16px）。
2. **统一抽屉关闭按钮**：
   - `web/src/components/TableOfContents.tsx`：`<CloseIcon>` 从 `size="md"` 调整为 `size="sm"`。
   - `web/src/components/MarginaliaRail.tsx`：`<CloseIcon>` 从 `size="md"` 调整为 `size="sm"`。
   - `web/src/components/DraftDrawer.tsx`：移除内联 `strokeWidth="2"` 的 SVG，复用统一的 `<CloseIcon size="sm" />`。
3. **统一发帖浮层（ComposeModal）底部工具栏**：
   - `web/src/components/ComposeModal.tsx`：“添加媒体”复用 `<GalleryIcon size="sm" />`，“标题”及全屏切换按钮图标统一为 16px 与 1.5 线宽。
   - `web/src/components/VoiceInputButton.tsx`：语音打字按钮图标统一为 16px 与 1.5 描边。
   - `web/src/components/VoiceNoteRecordButton.tsx`：录音附件按钮图标统一为 16px 与 1.5 描边。

## 回归验证

- [x] 全局类型检查（`npm run typecheck`）通过。
- [x] 前端打包生产构建（`npm run web:build`）通过。
- [x] 侧边栏、移动抽屉、发帖浮层各状态下图标视觉比例恢复精致、轻盈与完全统一。
