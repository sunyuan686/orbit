# 个人生活档案 (about) 与空间公约 (rules) 整合与交互重构

> 创建：2026-09-19 · 状态：已完成

## 目标

为底层迁移并入 `user.about`（个人喜好档案）与 `space_profile.rules`（空间恋爱公约）的历史备忘数据提供优雅、直觉且零干扰的原生阅读与编辑界面，同时遵循 60-30-10 刊物排版与 `useLayer` 导航栈规范。

## 步骤

1. **数据库字段精简与迁移治理**：
   - 将 `user` 表的 `preferences_profile` 字段重构精简为 `about`；
   - 更新本地 SQLite 表结构，确保历史喜好数据完整迁移保留；
   - 同步修正远程待执行迁移脚本 `src/db/migrations/0028_content_types_and_albums.sql`。
2. **后端接口与数据模型对齐**：
   - 在 `src/services/space/space-authors.ts` 与 `src/api/account.ts` 中暴露 `about` 字段；
   - 支持通过 `PUT /api/account/profile` 更新当前用户或本空间伴侣的 `about` 档案。
3. **“我们”空间卡片交互重构（SpaceHeroCard）**：
   - 移除此前冗余的横幅卡片与复杂入口；
   - 点击伴侣名字（如“示例用户甲” / “示例用户乙”）直接唤起《个人生活手札》抽屉（`UserAboutSheet`）；
   - 点击相爱天数（如“1,585 天”）直接唤起《空间档案与恋爱公约》抽屉（`SpaceCovenantSheet`）；
   - 右上角辅助入口提供“时光与约定”轻量级示能。
4. **系统设置空间档案补齐**：
   - 在 `SpaceSettingsPanel.tsx` 空间档案中补齐“我们的约定”（`rules`）多行编辑组件。
5. **规范与质量验证**：
   - 抽屉统一集成 `useLayer` 导航栈，支持移动端返回手势与 Esc 物理关闭；
   - 运行并通过 `typecheck`、`web:build` 与 58 项单元测试。

## 完成标准（可验证）

- [x] `npm run typecheck` & `npm run web:build` & `npm test` 全部绿灯通过
- [x] 本地数据库 `user.about` 字段正确映射且原备忘数据完整
- [x] 访问 `/us` 页面，点击作者姓名可唤起并编辑个人档案；点击相爱天数可唤起空间纪念日与公约
- [x] 访问 `/settings?tab=space` 页面，可编辑空间公约
- [x] 所有浮层完全兼容手势返回与历史栈回退
