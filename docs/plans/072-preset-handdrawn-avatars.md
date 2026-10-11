# 预置温情手账情侣头像

> 创建：2026-10-10
> 状态：已完成

## 目标

为双人空间增加一组温情、极简手账线描风的预置头像（基于 DiceBear Lorelei 开源 CC0 库）：
1. 静态内置 8 款成对呼应的矢量手账插画（4 组情侣搭配），纯本地资源，无外部网络依赖，支持离线与暗色模式。
2. 当用户未设置头像时，默认根据用户身份分配一对温暖默契的预置手账头像，告别单调生硬的单字占位符。
3. 在「设置 → 个人资料」中提供直观的手账插画点选面板，支持一键切换预设或上传自定义生活照。

## 步骤

1. **静态资源与预设定义**：
   - 验证并保存 8 款精选手账插画至 `web/public/presets/avatars/`。
   - 创建 `web/src/lib/presetAvatars.ts`，导出预置列表与默认头像解析函数。
2. **设置页交互集成**：
   - 在 `web/src/pages/Settings.tsx` 的个人资料中增加「手账插画」选择器。
   - 采用 Better Auth `authClient.updateUser` 作为单一事实来源（SSOT）原子更新数据库并重签 Session Cookie，彻底杜绝双写胶水补丁。
3. **全局默认头像展示升级**：
   - 更新 `UserAccount.tsx`、`UsMenuSheet.tsx` 与 `UserAboutSheet.tsx`，当未上传头像时使用预置手账插画。
4. **验证**：
   - 运行 `npm run web:build` 与 `npm run typecheck`。

## 完成标准（可验证）
- [x] `npm run web:build` 校验通过，无类型错误。
- [x] `npm run typecheck` 校验通过，无类型错误。
- [x] 设置页个人资料可直接点击选择 8 款预置手账头像。
- [x] 侧边栏、移动端抽屉与关于手帖在未上传照片时展示精致手账头像。
