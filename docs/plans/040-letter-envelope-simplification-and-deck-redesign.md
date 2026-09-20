# 信封样式简化与自然微错位回信叠放

> 创建：2026-09-08 · 
> 状态：已完成

## 目标

简化信箱列表信封卡片样式，去除过度拟物的折口、火漆印与复古邮戳，遵循 60-30-10 与三元字体规范；并基于选项 2 实现自然微错位回信叠放效果（Natural Paper Deck），代码保持直白干净、无补丁胶水代码。

## 步骤

1. 重构 `LetterComposeCard.tsx`，移除拟物折口与火漆，改为纯白同构极简新建卡。
2. 重构 `ArticleList.tsx` 中的 `LetterEnvelope`、`LetterThreadItem` 与 `LetterReplyMini`：
   - 移除拟物折口、火漆印章、双圈邮戳；
   - 规范作者与 Mono 日期排版；
   - 实现自然微错位回信叠放纸层（Deck Layers）与平滑展开交互。
3. 重构 `index.css`：
   - 清理所有废弃的拟物信封样式（flap、seal、postmark、stamp 等）；
   - 移除 `orbit-desk-item` 卡片乱序旋转；
   - 建立规范的 `.orbit-env`、`.orbit-letter-deck` 及自然微错位叠层样式。
4. 双列瀑布流重构与去胶水优化（彻底消除卡片高度不同导致的死白空隙）：
   - 参考动态流（`Home.tsx`）独立双列 Flex 瀑布流架构（`leftLetterTree` 与 `rightLetterTree`）；
   - 彻底移除 `useMaxWidthMd` 与重复 JSX 分支，响应式下沉至样式 Token（`gap-3 sm:gap-6`、`p-3.5 sm:p-5`）；
   - 清理废弃的 `.orbit-desk` CSS Grid 限制。
5. 执行类型检查与构建验证。

## 完成标准（可验证）

- [x] `npm --prefix web run build` 成功，无类型报错与构建问题。
- [x] 信箱列表页首位新建卡与信封卡片呈现纯白克制刊物风格，无倒三角与火漆印。
- [x] 纸张叠放厚度真实呈现回信关系，无多余冗余徽章与过度文案。
- [x] 全端统一独立双列瀑布流吸附排列，彻底消除死白空白与胶水代码。
