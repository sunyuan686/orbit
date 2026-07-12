# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

**v0.0.1 为基线发布**（手工整理历史能力）。此后由 [release-please](https://github.com/googleapis/release-please) 根据 Conventional Commits 自动更新。

功能路线图见 [ROADMAP.md](ROADMAP.md)。

---

## [0.0.1] - 2026-06-24

### 新功能

- 核心内容平台：日记、时间线、留言板、信箱、备忘录 CRUD
- TipTap 富文本编辑器，支持图片粘贴、拖拽上传与 HEIC 转换
- 情侣专属认证（better-auth，最多 2 个账号，规范作者名）
- 信件主信 + 回信树状结构
- FTS5 全文搜索（trigram 分词，支持类型过滤与 snippet）
- 评论系统：底部评论 + 选中文字行内边注（混合锚定算法）
- 双模式运行：本地 Node.js + SQLite，生产 Cloudflare Workers + D1 + R2
- 响应式 UI、暗色主题、文章目录 TOC
- Markdown 历史数据导入（`content/` → SQLite）
- GitHub Actions 自动部署到 Cloudflare Workers

[0.0.1]: https://github.com/sunyuan686/orbit/releases/tag/v0.0.1
