---
name: git-commit
description: Orbit 项目的 git commit、push 与配套文档规范。仅在用户明确要求提交、推送、写 commit message，或提及 orbit-git-commit 时使用；不自动触发。
disable-model-invocation: true
---

# Orbit Git Commit & Push

## Commit 格式（Conventional Commits）

```
<type>(<scope>): <description>
```


| type                    | 用途           | 版本    |
| ----------------------- | ------------ | ----- |
| `feat`                  | 新功能          | minor |
| `fix`                   | Bug 修复       | patch |
| `perf` / `refactor`     | 性能 / 重构      | patch |
| `docs`                  | 仅文档          | 无     |
| `chore` / `test` / `ci` | 杂项 / 测试 / CI | 无     |


破坏性变更：`feat(api)!: ...` 或 footer `BREAKING CHANGE:` → major。

**scope 常用**：`diary` `letter` `memo` `comments` `search` `auth` `editor` `api` `deploy` `roadmap`

**示例**：

```
feat(settings): add anniversary settings page
fix(comments): remap inline anchors after body edit
docs(roadmap): mark audit log as planned
```

- description 用英文、祈使句、小写开头、无句号
- 仅当用户**明确要求**时才创建 commit；不要主动提交

## 提交前检查

```
- [ ] commit message 符合上述格式
- [ ] 功能增减 → 更新 ROADMAP.md 状态
- [ ] 架构/表结构变更 → 更新 ARCHITECTURE.md
- [ ] 不手改 CHANGELOG.md（release-please 自动生成）
- [ ] 不提交 .env、密钥、data/ 运行时数据
```

## Push 流程

**日常（单人，默认）**：直接推 `main`

```bash
git add <files>
git commit -m "feat(scope): description"
git push origin main
```

**可选（留 review 记录）**：分支 + PR

```bash
git checkout -b feat/short-name
git push -u origin feat/short-name
# gh pr create → 合并到 main
```

## 发版（无需每次手动做）

`feat` / `fix` 累积到 `main` 后，release-please 自动开 **Release PR** → review 后合并 → 自动更新 `CHANGELOG.md` 并打 tag。

维护者不要手动改 CHANGELOG、不要自行打版本 tag（基线 `v0.0.1` 除外）。

## 详细说明

见 [docs/CONTRIBUTING.md](../../../docs/CONTRIBUTING.md)。