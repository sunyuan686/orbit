# 头像解耦与个人资料头像上传支持

> 创建：2026-10-09
> 状态：已完成

## 目标

遵循第一性原理与双人空间极简刊物美学：
1. 动态卡片（`MomentCard`）彻底去除重复的单字圆形头像，回归干净纯粹的署名与时间排版（如 `初一 · 10月9日`）。
2. 在个人资料（`Settings → Profile`）中支持真实的头像上传、更新与移除，使头像作为亲密关系表达在侧边栏、移动端抽屉与空间资料中生效。

## 步骤

1. **后端数据与接口**：
   - `src/services/space/space-authors.ts`：在 `SpaceAuthor` 和查询中补齐 `image: user.image`。
   - `src/api/account.ts`：在 `AccountProfile` 和 `loadAccountProfile` 中返回 `image`，在 `PUT /profile` 中支持 `image` 字段更新与清理。
2. **前端 API 与类型**：
   - `web/src/lib/api.ts`：`SpaceAuthor` 与 `AccountProfile` 增加 `image` 字段，`updateProfile` 支持传入 `{ name?: string; image?: string | null }`。
3. **卡片流去头像化**：
   - `web/src/components/MomentCard.tsx`：移除 `initial` 单字头像圆圈，保留文字署名与日期。
4. **导航与抽屉头像适配**：
   - `web/src/components/UserAccount.tsx`：当 `user.image` 存在时渲染实际头像图片，不存在时保底单字。
   - `web/src/components/UsMenuSheet.tsx`：顶部个人卡片支持展示用户实际头像图片。
   - `web/src/components/UserAboutSheet.tsx`：档案弹窗展示作者真实头像（若有）。
5. **设置页个人资料头像设置**：
   - `web/src/pages/Settings.tsx`：在「个人资料」Tab 下提供头像预览、上传与移除操作。
6. **全量构建验证**：
   - 运行 `npm run web:build` 与 `npm run typecheck` 确保类型与构建零错误。

## 完成标准（可验证）
- [x] `npm run web:build` 校验通过，无类型错误。
- [x] `npm run typecheck` 校验通过，无类型错误。
- [x] `MomentCard` 不再显示生硬的单字圆形占位符，排版自然舒适。
- [x] 设置页个人资料可选择图片上传头像，更新后侧栏与抽屉即时显示新头像，且支持移除。
