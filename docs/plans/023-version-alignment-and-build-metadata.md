# 版本体系与构建元数据规范化改造

> 创建：2026-09-03 · 
> 状态：已完成

## 目标

遵循单一事实来源（SSOT）最佳实践，消除前端静态硬编码版本号，在构建期注入权威版本（package.json）与 Git Commit Hash，并对齐 Release Please 自动化发版流。

## 步骤

1. **构建层注入**：在 `web/vite.config.ts` 读取根目录 `package.json.version` 和 Git Commit 短 Hash，通过 `define` 注入全局编译常量 `__APP_VERSION__` 与 `__COMMIT_HASH__`。
2. **TS 类型声明**：创建 `web/src/vite-env.d.ts`，补充全局常量类型。
3. **前端消费与呈现**：修改 `web/src/components/AboutSettingsPanel.tsx`，动态展示应用版本与 Commit 标识，彻底移除所有写死字符串。
4. **编译与类型验证**：执行 `npm run typecheck` 与 `npm run web:build` 确保 0 报错。
5. **发布对齐指引**：指导或协助合并 GitHub 上的 Release PR #12，完成 0.3.0 正式发版。

## 完成标准（可验证）

- [x] `npm run typecheck` 0 错误
- [x] `npm run web:build` 编译成功且生成正确的注入产物
- [x] 前端「关于」页面展示动态版本与短 Commit Hash
