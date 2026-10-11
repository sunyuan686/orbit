# npm 锁文件不同步导致 Actions 安装失败

> 创建：2026-10-11 · 状态：已修复

## 现象

提交 `01cbb79` 的部署工作流在 `Install root dependencies` 执行 `npm ci` 时失败：锁文件中的 `zod@4.4.3` 不满足清单要求的 `^4.6.5`，后续构建、数据库迁移和部署均跳过。

## 根因与修复

根目录 `package.json` 已更新 Zod、移除 Anthropic 依赖并精确锁定 Wrangler，但 `package-lock.json` 未同步。仅使用本地已有依赖运行测试和构建无法发现该问题。

通过 npm 同步锁文件，并增加本次修复的干净安装验证。

## 回归验证

- 根目录与前端 `npm ci --no-audit --no-fund` 均通过。
- 类型检查、61 项测试、前端构建与 PWA 产物检查均通过。
- 修复提交 `744e25d` 对应部署工作流 `38118203829` 全部通过，完成 Worker 发布；Release 工作流也已成功。
