# 下拉刷新状态机与确定性反馈实施

> 创建：2026-10-09 · 状态：已完成

## 目标

彻底解决下拉刷新“无终态反馈、无法区分成功/无新内容/失败”的问题。遵循第一性原理，为 `PullToRefresh` 引入完整终态状态机与物理/视觉双重闭环反馈，杜绝静默失败。

## 步骤

1. 升级 `web/src/components/ui/PullToRefresh.tsx` 内部状态机（`idle` -> `pulling` -> `refreshing` -> `success` / `error`）。
2. 在 `success` 终态呈现 14px `CheckIcon`（Accent 色）并配合 12ms 微触觉反馈，停留 350ms 后平滑回弹。
3. 在 `error` 终态呈现 `AlertIcon`（Danger 色）、告警触觉并在页面弹出 `toast.error`，彻底杜绝静默失败。
4. 在 `HomePage.tsx` 与 `ArticleList.tsx` 的 `handleRefresh` 中显式检查 Query 结果的 `isError` 并向上抛出。
5. 运行 `npm run web:build` 验证。

## 完成标准（可验证）

- [x] 刷新成功后：Spinner 变为微型对勾停留 350ms 后收起，触屏设备伴随 12ms 触觉脉冲。
- [x] 刷新失败时（模拟断网）：指示器变红并呈现叹号，弹出错误 Toast，不再静默失效。
- [x] `npm run web:build` 编译打包 100% 通过无告警。
