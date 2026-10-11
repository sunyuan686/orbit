# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

**v0.0.1 为基线发布**（手工整理历史能力）。此后由 [release-please](https://github.com/googleapis/release-please) 根据 Conventional Commits 自动更新。

功能路线图见 [ROADMAP.md](ROADMAP.md)。

---

## 0.3.0 (2026-09-20)


### 新功能

* add list thumbs, image decks, daily scratch cards, and pwa install
* **ai:** add max agent step limit and summary instructions
* **ai:** add multimodal chat attachments and pwa lifecycle updates
* **content:** converge content types to moments and letters with albums and mobile architecture
* **memories:** redesign memory atlas with asset highlights, scratch cards and activity heatmap
* **ui:** centralize ai prompts, redesign settings infotips, and polish mobile interactions
* **ui:** polish pwa lifecycle, responsive notifications, and search bar
* unify space timezone, pwa update controls, content filters, and mobile polish


### 修复

* **auth:** add account issuer column and migration for better-auth 1.7.0
* **ci:** anchor root ignore paths to restore tracked content services
* **plain-text:** extract clean plain text using state machine scanner without markdown markers
* resolve audio playback conflicts, articles earliest year query, and mobile layout issues
* **settings:** 完善修改密码流程


### 重构

* **arch:** reorganize domain services, extract shared core, and restructure frontend
* **memo:** consolidate memo table into entry and clean up dual query branches


### 文档

* add componentization and zero-patch engineering rules to 020 spec
* add content types and architecture refactor spec (020)
* add design consistency constraints to 020 spec
* **agents:** reorganize documentation structure according to agent rules
* **guides:** extract db migration guide to docs/guides

## 0.2.0 (2026-08-08)


### 新功能

* **ai:** refactor model specifications, provider settings, and voice tools


### 重构

* **editor:** optimize mobile pwa native editor experience and layout

## 0.1.0 (2026-08-06)


### 新功能

* **account:** store solar and lunar birthdays independently
* **activity:** add writing heatmap and streak at /activity
* **activity:** 写作热力图与连续记录
* add gallery page with R2-backed media browser
* **ai:** add dismissible article context pill in chat panel
* **ai:** add feishu bot streaming chat and prompt structured grounding
* **ai:** add multi-provider settings and custom OpenAI connections
* **ai:** add streaming chat assistant with model settings
* **ai:** add voice transcription support and audio note recording
* **ai:** add write_content tool with approval and shared chat runtime
* **ai:** cache model catalog and fix mobile composer chrome
* **ai:** enhance tool call rendering and add message polaroid view
* **ai:** render chat markdown and fix mobile composer
* **ai:** unify history sheet and polish chat chrome
* **api:** add Bearer API Token for external REST access
* **companion:** add proactive companion scheduling
* **editor:** add branded app boot screen
* **editor:** add draft drawer, draft status support, and mobile UI enhancements
* **editor:** add thought compose flow and blurhash image placeholders
* **entry:** add note and appreciation types with reasoning stream enhancements
* **feishu:** add AI multi-turn chat and cardkit streaming support
* **feishu:** add instant message reaction feedback and fix thread reply api
* **feishu:** align feishu ai chat with web agent and add companion test push
* **feishu:** enhance streaming cardkit, typing-done reaction flow and session isolation
* **feishu:** improve ai chat observability
* **feishu:** send interactive card with direct link for entry creation and update DONE reaction
* **gallery:** track asset references for linked/orphan
* generic space onboarding with custom names and invite flow
* **home:** add landing page as default route
* **integrations:** add feishu bot and in-app notifications
* **integrations:** add feishu callbacks and local tunnel dev workflow
* **integrations:** Feishu bot, notifications and local dev auth fix
* **letter:** add thread timeline, reply flow and list grouping
* **letter:** redesign list cards as envelope peek
* **list:** type-specific entry cards with snippet and cover
* **memories:** add love memories star map, atlas, and milestones
* **phase-a:** add audit log, structured logging and comment edit UI
* **phase-a:** add design system, article metadata and edit policies
* **phase-a:** add space profile, settings and marginalia rail layout
* **settings:** add solar/lunar birthday on profile
* **settings:** mobile drill-down, merge space profile and AI model catalog
* **ui:** polish account menu, letter thread, and styles
* **ui:** replace native confirm with in-app dialog
* **voice:** add smooth/raw/bullets/formal transcribe modes with persisted setting
* **web:** add PWA install support with offline app shell
* **web:** migrate data fetching to react-query
* **web:** PWA 可安装与离线壳
* 电子相册（R2 全集浏览、关联筛选、安全删除）


### 修复

* **ai:** pass worker env bindings to langfuse trace and improve error logs
* **ai:** polish composer spacing and reasoning disclosure
* **api:** generate blurhash on client like jant for worker deploy
* **api:** keep sharp image processing out of worker bundle
* **api:** strip HTML when deriving bodyText for list snippets
* **api:** update feishu companion card button format
* **auth:** allow 127.0.0.1 origin for local dev login
* **build:** keep write-content types out of web import graph
* **db:** correct migration 0017 to incremental DDL
* **deploy:** backup and restore asset table during 0021 entry schema migration
* **deploy:** bump CI Node.js to 22 for wrangler v4
* **editor:** avoid TipTap Image name clash in preload
* **editor:** block read-only article input; polish buttons, motion and icons
* **editor:** preload remote image before swapping blob preview
* **editor:** prevent double toast on entry deletion and normalize ai date input
* **editor:** show image loading placeholder in read view
* **feishu:** align CardKit 2.0 schema and streaming_mode config
* **feishu:** align Langfuse trace input, tools format, and output updating with web chat
* **feishu:** ensure DONE reaction and recover from AI chat failures
* **feishu:** execute approved writes directly instead of LLM resume
* **feishu:** fix CardKit streaming sequence conflict and prevent message truncation
* **feishu:** improve group chat attribution, mentions, and AI reliability
* **feishu:** keep write-approval resume alive and restore tool signatures
* **feishu:** require sequence parameter and put method for CardKit 2.0 streaming
* **feishu:** streamline write approval flow with richer card summary
* **feishu:** throttle CardKit stream updates and cap subrequests to prevent Cloudflare limit error
* **feishu:** unify buildFeishuThreadKey so /clear and /reset correctly target session
* **gallery:** keep blurhash visible while lazy images load
* **gallery:** show blurhash placeholders while images load
* **gallery:** stabilize image load and prevent blurhash flash
* **memories:** avoid loading full body_text when listing nodes
* **memories:** chunk cover lookups under D1's 100-param limit
* **memo:** sort memo list by recency and refine card display
* **settings:** keep deepseek key draft after connection test
* **ui:** keep form controls at 16px to stop ios auto-zoom


### 性能

* **api:** cut auth D1 roundtrips and add optional article pagination
* lazy-load routes, batch db ops, and compress uploads


### 重构

* **ai:** unify write approval completion across web and Feishu
* **api:** extract shared generateId helper
* **editor:** parse markdown body with marked library
* **schema:** remove DB-level entry_type_check to decouple entry types from SQL migrations


### 文档

* **activity:** add ACTIVITY.md and sync HOME/ROADMAP
* add API Token design document
* add gallery requirements in GALLERY.md
* **agents:** add no-glue-code principle
* **feishu:** add integration plan and Phase C notification roadmap
* **feishu:** plan companion push and bot chat
* **idea:** restore notes in IDEA.md
* refresh product keywords and idea notes
* refresh product notes, image roadmap, and memories bug writeup
* reorganize specs into docs/specs and add AGENTS.md
* **roadmap:** plan love memories and sync phase notes


### CI

* **deploy:** pass VITE_TURNSTILE_SITE_KEY secret during build step

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
