# 移除空间档案寄语 (Slogan)

> 创建：2026-10-06 ·
> 状态：已完成

## 目标

一句话：移除空间档案设置与展示中冗余的寄语（slogan）相关逻辑，保持界面精简与克制。

## 步骤

1. 前端 UI 清理：
   - 移除 `SpaceSettingsPanel.tsx` 中的寄语表单项及对应 state 和提交字段。
   - 更新 `Settings.tsx` 中空间档案的导航描述（"起始日与约定"）。
   - 移除 `SpaceHeroCard.tsx` 中的寄语渲染及 `tagline` 中的 slogan 依赖。
   - 清理 `index.css` 中 `.orbit-home-hero-slogan` 的样式规则。
2. 前端 API 与旧页面清理：
   - 更新 `web/src/lib/api.ts` 中 `SpaceProfile` / `UpdateSpacePayload` / `formatSpaceTagline`。
   - 删除未使用的废弃文件 `web/src/pages/Space.tsx`。
3. 后端服务清理：
   - 更新 `src/space-profile.ts` 与 `src/api/space.ts`，移除 `slogan` 键值读取、校验及写入逻辑。
4. 验证与构建：
   - 运行服务端测试及前端构建 `npm run web:build`。

## 完成标准（可验证）

- [x] `npm test` 通过
- [x] `npm run web:build` 通过
- [x] 设置页“空间档案”中不再出现寄语输入框
- [x] “我们”页面顶部 SpaceHeroCard 中不再出现寄语展示
