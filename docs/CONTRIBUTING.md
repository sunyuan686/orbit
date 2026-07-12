# 贡献指南

感谢关注 Orbit。本文说明如何提交代码、维护文档，以及版本发布流程。

---

## 开发环境

见 [README.md](../README.md#如何启动)。

---

## Commit 规范（Conventional Commits）

所有提交到 `main` 的 commit message 请遵循 [Conventional Commits](https://www.conventionalcommits.org/)，以便 **自动生成 CHANGELOG** 与语义化版本号。

### 格式

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

### Type 说明

| type | 含义 | 是否计入 CHANGELOG | 版本影响 |
|------|------|-------------------|----------|
| `feat` | 新功能 | ✅ 新功能 | minor ↑ |
| `fix` | Bug 修复 | ✅ 修复 | patch ↑ |
| `perf` | 性能优化 | ✅ 性能 | patch ↑ |
| `refactor` | 重构（无行为变化） | ✅ 重构 | patch ↑ |
| `docs` | 仅文档 | ✅ 文档 | 无（默认） |
| `chore` | 构建 / 依赖 / 杂项 | 隐藏 | 无 |
| `test` | 测试 | 可选 | 无 |
| `ci` | CI 配置 | 可选 | 无 |

带 `!` 或 footer `BREAKING CHANGE:` 视为破坏性变更 → **major** 版本升级。

### 示例

```bash
feat(search): add filter by content type
fix(comments): remap inline anchors after body edit
docs(roadmap): mark settings page as in progress
chore(deps): bump drizzle-orm to 0.45.2
feat(api)!: remove legacy markdown import endpoint

BREAKING CHANGE: /api/import-md removed; content is managed in the database via the app
```

### Scope 建议

`diary` · `letter` · `memo` · `comments` · `search` · `auth` · `editor` · `api` · `deploy` · `roadmap` · `changelog`

---

## 文档维护

| 文档 | 何时更新 | 是否手改 |
|------|----------|----------|
| [ROADMAP.md](../ROADMAP.md) | 功能状态变化、排期调整 | ✅ 手改 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 架构、表结构、目录变更 | ✅ 手改 |
| [DEBUGGING.md](./DEBUGGING.md) | 白屏/边注等排障案例、日志约定 | ✅ 手改 |
| [BUGS.md](./BUGS.md) | 已知 Bug 清单与回归记录 | ✅ 手改 |
| [specs/](./specs/) | 各产品能力设计稿（对应 ROADMAP 条目）；文件名小写 + `-` | ✅ 手改 |
| [DESIGN.md](../DESIGN.md) | 视觉 token、组件、文案规则变更 | ✅ 手改，并同步 `web/src/index.css` |
| [CHANGELOG.md](../CHANGELOG.md) | 每次发布 | ❌ **由 release-please 自动生成** |
| [README.md](../README.md) | 启动方式、项目定位变化 | ✅ 手改 |

**不要手动编辑 CHANGELOG 中尚未发布的 `[Unreleased]` 区块**；release-please 会在 Release PR 中统一更新。

功能 PR 合并前请确认：

- [ ] 若涉及功能增减，已更新 [ROADMAP.md](../ROADMAP.md) 对应行状态
- [ ] 若改 UI，已对照 [DESIGN.md](../DESIGN.md)，并同步 `web/src/index.css` tokens
- [ ] commit message 符合 Conventional Commits
- [ ] 若改架构，已更新 [ARCHITECTURE.md](./ARCHITECTURE.md)

---

## UI / 设计

视觉规范以根目录 **[DESIGN.md](../DESIGN.md)** 为准（[Google DESIGN.md](https://github.com/google-labs-code/design.md) 格式）。参考系来自 [getdesign.md](https://getdesign.md/) 上的 [Notion](https://getdesign.md/notion/design-md) 与 [Vercel Geist](https://vercel.com/design.md)，并针对 Orbit「克制、浪漫、高级」的内容产品定位做了裁剪。

**改 UI 时**

1. 先读 `DESIGN.md` 的 Overview 与 Do's and Don'ts
2. 使用 `web/src/index.css` 中的 CSS 变量（`--color-*`、`--type-*`）或 `.orbit-*` 类
3. 不要在组件里硬编码 `oklch()` / `#hex` 颜色或任意 `fontSize`
4. 新增 token 时同时更新 `DESIGN.md` YAML 与 `index.css`

**常用工具类**

| 类名 | 用途 |
|------|------|
| `.orbit-content` | 列表/搜索 680px 居中列 |
| `.orbit-editor-layout` | 编辑页 720px 居中列 |
| `.orbit-muted` | 次要说明 / 加载中 |
| `.orbit-btn-primary` | 每页唯一主操作 |
| `.orbit-btn-danger` | 删除等破坏性操作 |
| `.orbit-entry-card` | 列表卡片行 |
| `.orbit-input` / `.orbit-title-input` | 表单输入 |
| `.orbit-editor-chrome` | TipTap 编辑外壳 |
| `.orbit-auth-page` / `.orbit-auth-panel` | 登录注册页 |
| `.orbit-toc-link` / `.orbit-toc-fab` | 文章目录 |

Agent skill：[.cursor/skills/orbit-design/SKILL.md](../.cursor/skills/orbit-design/SKILL.md)

---

## 发布流程（Release Workflow）

Orbit 使用 [release-please](https://github.com/googleapis/release-please) 自动管理版本与 CHANGELOG。

### 流程

```mermaid
flowchart LR
    A[feat/fix commit 推送到 main] --> B[release-please Action]
    B --> C{有可发布变更?}
    C -->|是| D[打开/更新 Release PR]
    D --> E[合并 Release PR]
    E --> F[打 Git Tag + GitHub Release]
    E --> G[更新 CHANGELOG.md + package.json 版本]
    C -->|否| H[无操作]
```

### 配置文件

| 文件 | 作用 |
|------|------|
| `release-please-config.json` | CHANGELOG 分区、release 类型 |
| `.release-please-manifest.json` | 当前版本号 |
| `.github/workflows/release.yml` | 触发 release-please |

### 维护者操作

1. 日常开发：正常 `feat:` / `fix:` commit 合并到 `main`
2. release-please 自动创建 **Release PR**（标题如 `chore(main): release 0.1.0`）
3. Review Release PR 中的 CHANGELOG 与版本号
4. **合并 Release PR** → 自动创建 GitHub Release 与 Git tag
5. `deploy.yml` 与 `release.yml` 独立运行：部署不依赖发版

### 首次启用（一次性）

本仓库在引入 release-please 前已有开发历史，基线版本 **v0.0.1** 见 [CHANGELOG.md](../CHANGELOG.md)。

合并 release 工作流后，维护者需在 `main` 打基线 tag（仅一次）：

```bash
git tag v0.0.1
git push origin v0.0.1
```

然后在 GitHub **Releases** 页面基于 `v0.0.1` 创建 Release，正文可粘贴 CHANGELOG `0.0.1` 章节。

此后每次 `feat` / `fix` 合并到 `main`，release-please 会自动累积变更并打开 Release PR。

### 版本策略

- `0.x.y`：核心功能快速迭代期
- `feat` → minor +1（`0.1.0` → `0.2.0`）
- `fix` / `perf` / `refactor` → patch +1（`0.1.0` → `0.1.1`）
- `BREAKING CHANGE` → major +1

---

## Pull Request

使用 PR 模板（`.github/pull_request_template.md`）填写变更说明与文档检查项。

推荐分支命名：`feat/xxx`、`fix/xxx`、`docs/xxx`。
