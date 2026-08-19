# 项目全局包结构第一性原理重构

> 创建：2026-08-16 · 
> 状态：已完成

## 目标

从第一性原理彻底治理 Orbit 的包结构与职责边界：消除前后端策略代码双写，按 6 大领域子系统重构后端 `src/services/`，理顺前端 `web/src/` 的 Context/Hook/Service 组织，并拆解 89KB 巨型组件与 313KB 单体样式。

## 步骤

1. **阶段一：建立 `src/shared/` 领域共享核**
   - 提取 `content-policies`、`comment-capabilities`、`ai-model-specs`、`entry-types`、`birthday`、`beijing-date` 到 `src/shared/`。
   - 配置前后端统一引用路径别名，删除前端 `web/src/lib/` 中的重复副本。
2. **阶段二：后端 `src/services/` 领域化分包**
   - 建立 `ai/`, `feishu/`, `companion/`, `content/`, `notify/`, `space/` 6 大子目录并归类 46 个文件。
   - 梳理导出入口 `index.ts`，更新 `src/api/` 及各处引用。
3. **阶段三：理顺前端 `web/src/` 结构与 API 请求层**
   - 从 `lib/` 抽出 Contexts 至 `web/src/contexts/`，抽出 Hooks 至 `web/src/hooks/`。
   - 按领域拆解 44KB 的 `web/src/lib/api.ts` 到 `web/src/services/`。
4. **阶段四：治理前端巨石单体组件与样式**
   - 拆解 89KB 的 `AiProvidersSettingsPanel.tsx`。
   - 模块化拆分 313KB 的 `index.css`。

## 完成标准（可验证）

- [x] `npm run typecheck` 0 错误
- [x] `npm run web:build` 编译打包 0 错误
- [x] 本地开发环境启动与编译验证通过
