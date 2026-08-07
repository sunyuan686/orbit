# Changelog

本文件遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

**v0.0.1 为基线发布**（手工整理历史能力）。此后由 [release-please](https://github.com/googleapis/release-please) 根据 Conventional Commits 自动更新。

功能路线图见 [ROADMAP.md](ROADMAP.md)。

---

## [0.1.0](https://github.com/sunyuan686/orbit/compare/v0.0.1...v0.1.0) (2026-08-06)


### 新功能

* **account:** store solar and lunar birthdays independently ([2d36bd5](https://github.com/sunyuan686/orbit/commit/2d36bd598a375a127b6d51bc7e05d9d30f92330e))
* **activity:** add writing heatmap and streak at /activity ([6b755a4](https://github.com/sunyuan686/orbit/commit/6b755a45eb8014d298a265cb584c4b2a07439338))
* **activity:** 写作热力图与连续记录 ([4a2aa0c](https://github.com/sunyuan686/orbit/commit/4a2aa0c4132c1be37ee9d8c573ffd4c63b0fbef0))
* add gallery page with R2-backed media browser ([1217b60](https://github.com/sunyuan686/orbit/commit/1217b60b1ef94ec6a4e3304b76c6fa5c553215a3))
* **ai:** add dismissible article context pill in chat panel ([8c16ddf](https://github.com/sunyuan686/orbit/commit/8c16ddf3aafd3553d829cce3ff446efbd9cf02ac))
* **ai:** add feishu bot streaming chat and prompt structured grounding ([987887f](https://github.com/sunyuan686/orbit/commit/987887f074ed98e3d43bca1801bf41e4f4577e76))
* **ai:** add multi-provider settings and custom OpenAI connections ([7502bac](https://github.com/sunyuan686/orbit/commit/7502bac3bdb03296a6b6839619f499aeb90d71ce))
* **ai:** add streaming chat assistant with model settings ([fe86653](https://github.com/sunyuan686/orbit/commit/fe8665394237e4b7ebce61b8fbc403c820276ae9))
* **ai:** add voice transcription support and audio note recording ([c59fe69](https://github.com/sunyuan686/orbit/commit/c59fe692fed024cc878873f000166f3119ddba3a))
* **ai:** add write_content tool with approval and shared chat runtime ([ea09819](https://github.com/sunyuan686/orbit/commit/ea09819d5f7482c71057137a4e5d44e32f6fd5bf))
* **ai:** cache model catalog and fix mobile composer chrome ([b7e5189](https://github.com/sunyuan686/orbit/commit/b7e5189331984455289232697cb6d43ecb4a6380))
* **ai:** enhance tool call rendering and add message polaroid view ([8feb166](https://github.com/sunyuan686/orbit/commit/8feb1664a19701a2bf245bc60c6f5629c4f2d870))
* **ai:** render chat markdown and fix mobile composer ([49bdafb](https://github.com/sunyuan686/orbit/commit/49bdafb95dad4de3d5351079ebdeb086351e1318))
* **ai:** unify history sheet and polish chat chrome ([b1efa07](https://github.com/sunyuan686/orbit/commit/b1efa0729b9aef31225f85dc36ca4aad01915808))
* **api:** add Bearer API Token for external REST access ([59e1a38](https://github.com/sunyuan686/orbit/commit/59e1a38f3f3e3d6fb5837193803d923adb76b243))
* **companion:** add proactive companion scheduling ([1a88565](https://github.com/sunyuan686/orbit/commit/1a885651ac139fe6450b7c3a29073ae60f26fe86))
* **editor:** add branded app boot screen ([b0d0984](https://github.com/sunyuan686/orbit/commit/b0d09842385e85b8c6425a5b917f3bea12daab6c))
* **editor:** add draft drawer, draft status support, and mobile UI enhancements ([6ec3749](https://github.com/sunyuan686/orbit/commit/6ec37493b0541529e9746c3262f382462274bea4))
* **editor:** add thought compose flow and blurhash image placeholders ([369c83c](https://github.com/sunyuan686/orbit/commit/369c83cdf5dc7f48626a4a8b6d5a5254278fc186))
* **entry:** add note and appreciation types with reasoning stream enhancements ([6181ce6](https://github.com/sunyuan686/orbit/commit/6181ce6a935a9583c1260e8bce3762c53024eceb))
* **feishu:** add AI multi-turn chat and cardkit streaming support ([55c9fc3](https://github.com/sunyuan686/orbit/commit/55c9fc328516032405bd621d4e34796ddf562d96))
* **feishu:** add instant message reaction feedback and fix thread reply api ([84b4507](https://github.com/sunyuan686/orbit/commit/84b45079ffe0d2a719ebd95830d73bb95cc107d9))
* **feishu:** align feishu ai chat with web agent and add companion test push ([34217d3](https://github.com/sunyuan686/orbit/commit/34217d304d6ba6a1a7d9e97c9d44f6f674e5833f))
* **feishu:** enhance streaming cardkit, typing-done reaction flow and session isolation ([558357d](https://github.com/sunyuan686/orbit/commit/558357d49f8ef3aa19e9ee78576d6b00701b0e48))
* **feishu:** improve ai chat observability ([15378a5](https://github.com/sunyuan686/orbit/commit/15378a5cafae44f3e101d8c2cd10657b75ceb1dc))
* **feishu:** send interactive card with direct link for entry creation and update DONE reaction ([331ca1a](https://github.com/sunyuan686/orbit/commit/331ca1a54b9311555549c807969c407977e3d515))
* **gallery:** track asset references for linked/orphan ([f3f4f44](https://github.com/sunyuan686/orbit/commit/f3f4f44942d0ae9587ff26eb7c31ecb5688b9218))
* generic space onboarding with custom names and invite flow ([9787ff7](https://github.com/sunyuan686/orbit/commit/9787ff7278b15a12a0a63858bb20c56399484a4b))
* **home:** add landing page as default route ([fad453a](https://github.com/sunyuan686/orbit/commit/fad453a59417f82cdc8ed5c88a1250e6e7054f29))
* **integrations:** add feishu bot and in-app notifications ([56e2e3b](https://github.com/sunyuan686/orbit/commit/56e2e3b383aec05d647cabf175c2b63603c6344b))
* **integrations:** add feishu callbacks and local tunnel dev workflow ([d803a36](https://github.com/sunyuan686/orbit/commit/d803a36dc37e456768a205ea913efd4d65a0cc6f))
* **integrations:** Feishu bot, notifications and local dev auth fix ([ac22d59](https://github.com/sunyuan686/orbit/commit/ac22d59f6817f966a78a200bc0556fdf3752dc40))
* **letter:** add thread timeline, reply flow and list grouping ([8b06bc9](https://github.com/sunyuan686/orbit/commit/8b06bc9c6776793bb355f73828f9546e06019c7d))
* **letter:** redesign list cards as envelope peek ([62406d4](https://github.com/sunyuan686/orbit/commit/62406d4412d75be29722ea690ef7634ad7264d4f))
* **list:** type-specific entry cards with snippet and cover ([d6dcdae](https://github.com/sunyuan686/orbit/commit/d6dcdae863f803a344d44357ec90c0fe8d70e645))
* **memories:** add love memories star map, atlas, and milestones ([960ac26](https://github.com/sunyuan686/orbit/commit/960ac2671fa19f86ea70635a34d49bc293e2f008))
* **phase-a:** add audit log, structured logging and comment edit UI ([e57bb36](https://github.com/sunyuan686/orbit/commit/e57bb36b0890236f2bfe71ae834d970b1d296a71))
* **phase-a:** add design system, article metadata and edit policies ([6c30b54](https://github.com/sunyuan686/orbit/commit/6c30b5475229cb6b1da964cbc6bc629afe4ebf03))
* **phase-a:** add space profile, settings and marginalia rail layout ([36129b1](https://github.com/sunyuan686/orbit/commit/36129b1f3e37ced4749269ae093873db853d9b3e))
* **settings:** add solar/lunar birthday on profile ([e288722](https://github.com/sunyuan686/orbit/commit/e2887225ce0c76e18618cc80ed43a41d67fdfbef))
* **settings:** mobile drill-down, merge space profile and AI model catalog ([ec1070a](https://github.com/sunyuan686/orbit/commit/ec1070a0a41555a53b99983fac94ffaed5d00b6e))
* **ui:** polish account menu, letter thread, and styles ([a35c02f](https://github.com/sunyuan686/orbit/commit/a35c02f2e807ab93aec4aad2dcee3ca3c12cbd9b))
* **ui:** replace native confirm with in-app dialog ([788bd43](https://github.com/sunyuan686/orbit/commit/788bd4311d43d5bfcf15db7b421deaeed1323f64))
* **voice:** add smooth/raw/bullets/formal transcribe modes with persisted setting ([525e637](https://github.com/sunyuan686/orbit/commit/525e637a2b697a95b70a1d8db406608c64a3ef96))
* **web:** add PWA install support with offline app shell ([bd65f10](https://github.com/sunyuan686/orbit/commit/bd65f10bada096896c6bc342a90131d24ab1cb5b))
* **web:** migrate data fetching to react-query ([2afb89f](https://github.com/sunyuan686/orbit/commit/2afb89fd22caca5d7c7ddfcd5886caebf7ff33ff))
* **web:** PWA 可安装与离线壳 ([e05e4b1](https://github.com/sunyuan686/orbit/commit/e05e4b1564886b889053e164322e8417820f4296))
* 电子相册（R2 全集浏览、关联筛选、安全删除） ([7495933](https://github.com/sunyuan686/orbit/commit/7495933579e8094307fcc64ef5d52a07c3edcc8b))


### 修复

* **ai:** pass worker env bindings to langfuse trace and improve error logs ([c5b1530](https://github.com/sunyuan686/orbit/commit/c5b1530e74f460dc4fbc9ed092e1138f859238b9))
* **ai:** polish composer spacing and reasoning disclosure ([3700b54](https://github.com/sunyuan686/orbit/commit/3700b547e59a684657e29038a8581f3646998966))
* **api:** generate blurhash on client like jant for worker deploy ([2c219f3](https://github.com/sunyuan686/orbit/commit/2c219f30842fad7c8c3f18991052993d7f6761c4))
* **api:** keep sharp image processing out of worker bundle ([1328321](https://github.com/sunyuan686/orbit/commit/1328321dcbbd534f105be2320bd462ab096039ce))
* **api:** strip HTML when deriving bodyText for list snippets ([10f14a1](https://github.com/sunyuan686/orbit/commit/10f14a1207b5e408587ed8f635fd3216c612db62))
* **api:** update feishu companion card button format ([20cece3](https://github.com/sunyuan686/orbit/commit/20cece32daa99a9cc5a5b1105619c9ab903aa108))
* **auth:** allow 127.0.0.1 origin for local dev login ([e0c9da9](https://github.com/sunyuan686/orbit/commit/e0c9da9ef3b5eae1901974519818a22a9e16e9f1))
* **build:** keep write-content types out of web import graph ([49041a4](https://github.com/sunyuan686/orbit/commit/49041a422f44120ed3d2530743a3bf329f7788c9))
* **db:** correct migration 0017 to incremental DDL ([f87a7a0](https://github.com/sunyuan686/orbit/commit/f87a7a0cd454e40a630d460faf857a9876e10749))
* **deploy:** backup and restore asset table during 0021 entry schema migration ([1f9e5c0](https://github.com/sunyuan686/orbit/commit/1f9e5c0fd8f8febb8b2b749db42bef279793a99d))
* **deploy:** bump CI Node.js to 22 for wrangler v4 ([8954e4d](https://github.com/sunyuan686/orbit/commit/8954e4dce6ad4aadcb3ab1511ad5b4578b677412))
* **editor:** avoid TipTap Image name clash in preload ([1c40bf8](https://github.com/sunyuan686/orbit/commit/1c40bf846359e51b4b9346f7fb3bcb89e88abbee))
* **editor:** block read-only article input; polish buttons, motion and icons ([2886026](https://github.com/sunyuan686/orbit/commit/288602628321c259d8a78c1edfe4aaee0a44ea57))
* **editor:** preload remote image before swapping blob preview ([ae74c44](https://github.com/sunyuan686/orbit/commit/ae74c44045ccbe8d4ba04e4c863afac2ebca8a00))
* **editor:** prevent double toast on entry deletion and normalize ai date input ([79b6bbd](https://github.com/sunyuan686/orbit/commit/79b6bbd88d2d7cafd0813d37f902ecaa6f13f4f7))
* **editor:** show image loading placeholder in read view ([3a00688](https://github.com/sunyuan686/orbit/commit/3a006884163fa46f3003c80d9c608238caf60d6e))
* **feishu:** align CardKit 2.0 schema and streaming_mode config ([5a5d6cf](https://github.com/sunyuan686/orbit/commit/5a5d6cf908562ac94b836e22970c0fcb0edaa07d))
* **feishu:** align Langfuse trace input, tools format, and output updating with web chat ([55aa8d7](https://github.com/sunyuan686/orbit/commit/55aa8d7dc4d861f015f5db3b6d1f290152ff082f))
* **feishu:** ensure DONE reaction and recover from AI chat failures ([8eef764](https://github.com/sunyuan686/orbit/commit/8eef764767c66a6f3aed6e7feeaadfa431faec9c))
* **feishu:** execute approved writes directly instead of LLM resume ([2343254](https://github.com/sunyuan686/orbit/commit/2343254715b1270a01d7579ba688c3e42eb55b95))
* **feishu:** fix CardKit streaming sequence conflict and prevent message truncation ([32e4fde](https://github.com/sunyuan686/orbit/commit/32e4fdeed6ec7fced513aae3480f15a7ebe6c1f9))
* **feishu:** improve group chat attribution, mentions, and AI reliability ([b91c805](https://github.com/sunyuan686/orbit/commit/b91c805eccf8b6e6e98db94ff191b82e84794fac))
* **feishu:** keep write-approval resume alive and restore tool signatures ([cdc7f0e](https://github.com/sunyuan686/orbit/commit/cdc7f0e1b87cc9aeb260bec69b42c1a92fa9edd5))
* **feishu:** require sequence parameter and put method for CardKit 2.0 streaming ([6576ef0](https://github.com/sunyuan686/orbit/commit/6576ef096b3e9cdcff5cc306915d41420ccae228))
* **feishu:** streamline write approval flow with richer card summary ([0f40e5c](https://github.com/sunyuan686/orbit/commit/0f40e5cd0e0be8242084edf8419e6c8dfbd67cf3))
* **feishu:** throttle CardKit stream updates and cap subrequests to prevent Cloudflare limit error ([ab4c3b9](https://github.com/sunyuan686/orbit/commit/ab4c3b965b3a132e0ec69804aea657e5aeb50915))
* **feishu:** unify buildFeishuThreadKey so /clear and /reset correctly target session ([7e2a3f7](https://github.com/sunyuan686/orbit/commit/7e2a3f70125ca453e351c769cb26d248ae132b91))
* **gallery:** keep blurhash visible while lazy images load ([bc3d57b](https://github.com/sunyuan686/orbit/commit/bc3d57b97d7351375af834de08867dcc9cf9ce93))
* **gallery:** show blurhash placeholders while images load ([e531f3e](https://github.com/sunyuan686/orbit/commit/e531f3e37ca6e735e1624ea843b78c5fd7aae1dd))
* **gallery:** stabilize image load and prevent blurhash flash ([ed87d58](https://github.com/sunyuan686/orbit/commit/ed87d5821709cd77a2b530d306f9da93a8e4fd3f))
* **memories:** avoid loading full body_text when listing nodes ([52c7f91](https://github.com/sunyuan686/orbit/commit/52c7f915433d8a694a07b27b56948af553f56bbb))
* **memories:** chunk cover lookups under D1's 100-param limit ([984795b](https://github.com/sunyuan686/orbit/commit/984795b1066b3c01f01b51239406b7efef971fdc))
* **memo:** sort memo list by recency and refine card display ([e788105](https://github.com/sunyuan686/orbit/commit/e78810512c786e345d8f5bd7ef88d9d8dc824b9f))
* **settings:** keep deepseek key draft after connection test ([6e79efb](https://github.com/sunyuan686/orbit/commit/6e79efb25cae5336b10bbafa76c14dc7a208fd9e))
* **ui:** keep form controls at 16px to stop ios auto-zoom ([0e5fd15](https://github.com/sunyuan686/orbit/commit/0e5fd15a4b797dbca6e1cb201b5127fe009f7895))


### 性能

* **api:** cut auth D1 roundtrips and add optional article pagination ([c3e8caa](https://github.com/sunyuan686/orbit/commit/c3e8caab3d180405569e68c717ab66dda9328e59))
* lazy-load routes, batch db ops, and compress uploads ([57e65f7](https://github.com/sunyuan686/orbit/commit/57e65f794ffd901c8cf1481cffd4a07ef4466269))


### 重构

* **ai:** unify write approval completion across web and Feishu ([9c9a7a3](https://github.com/sunyuan686/orbit/commit/9c9a7a354f6351b9bdca40acdfa495877501de1d))
* **api:** extract shared generateId helper ([c54d024](https://github.com/sunyuan686/orbit/commit/c54d02498f4c88b92eb4a72e2aa7e7fda1b3d61e))
* **editor:** parse markdown body with marked library ([2eb89d7](https://github.com/sunyuan686/orbit/commit/2eb89d7201150e884674394588fdd5e530e2a2c1))
* **schema:** remove DB-level entry_type_check to decouple entry types from SQL migrations ([6617579](https://github.com/sunyuan686/orbit/commit/6617579f484fb197878945ef78c7f9302981da9b))


### 文档

* **activity:** add ACTIVITY.md and sync HOME/ROADMAP ([595994b](https://github.com/sunyuan686/orbit/commit/595994bd4160d6294e7f1fe788ad562d224b156a))
* add API Token design document ([e1415bb](https://github.com/sunyuan686/orbit/commit/e1415bb3f4a0ec3412986cab74ec2725b303ff79))
* add gallery requirements in GALLERY.md ([8e56b6b](https://github.com/sunyuan686/orbit/commit/8e56b6be3bfeda39c56f9f5910ff04f7dc71c024))
* **agents:** add no-glue-code principle ([8430ba9](https://github.com/sunyuan686/orbit/commit/8430ba960571e5bfd5066482304863614361f8f2))
* **feishu:** add integration plan and Phase C notification roadmap ([1ac5858](https://github.com/sunyuan686/orbit/commit/1ac5858e91b893f9b57b6ca87fc9a783acbfa71d))
* **feishu:** plan companion push and bot chat ([c8c85f1](https://github.com/sunyuan686/orbit/commit/c8c85f1c503e20620a5ddf0aa8b4fb0a0c593bee))
* **idea:** restore notes in IDEA.md ([c01cd1f](https://github.com/sunyuan686/orbit/commit/c01cd1f134ccdd488ccaf3e37d78981afa60dcfb))
* refresh product keywords and idea notes ([5b5e1b0](https://github.com/sunyuan686/orbit/commit/5b5e1b0f767cf51a02d97a9d3b69bba278bce2ef))
* refresh product notes, image roadmap, and memories bug writeup ([34c5a85](https://github.com/sunyuan686/orbit/commit/34c5a85918050d43876e2e2038daab60ca0473f2))
* reorganize specs into docs/specs and add AGENTS.md ([616bd5f](https://github.com/sunyuan686/orbit/commit/616bd5f3d84d235e0c0302e4539212d91c3f1704))
* **roadmap:** plan love memories and sync phase notes ([e8e1718](https://github.com/sunyuan686/orbit/commit/e8e1718f18b1d5261e6008f71266a05e7ae06685))


### CI

* **deploy:** pass VITE_TURNSTILE_SITE_KEY secret during build step ([de23046](https://github.com/sunyuan686/orbit/commit/de2304648d27bcebb9e2f7737273794be352e6a6))

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
