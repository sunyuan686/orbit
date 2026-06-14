# Orbit

**名字的意义**
- Orbit = 轨道/环绕
- 两人彼此吸引、围绕彼此，稳定长期有节奏
- 克制、浪漫、高级

---
写方便，无压力。
数据格式友好，AI友好。

**功能大纲**

内容分类：
- 📖 日志：时间线、日常记录（文字、图片、排版）
- 💌 传情：留言板、信箱
- 📌 备忘录：约定、偏好、参考信息。
- 💰 记账（待实现）

扩展功能：
- 恋爱成长系统（信用等能力）
- 立体书（照片、故事）、电子相册
- 支持问答、总结、编辑
- 热力图、时光图

存储：本地优先 + 云端备份，方便迁移

---

**架构：本地 Server + Web UI**

```
浏览器 UI ──fetch──→ 本地 Server（Hono）──读写──→ 磁盘文件
                                                    ↑
CLI / AI（Claude Code）──直接读写──────────────────────┘
```

- 数据唯一源：磁盘文件（.md + 图片），无 IndexedDB
- Server 仅监听 localhost，外部不可访问
- AI/CLI 可直接读写磁盘文件，无需通过 API

**存储方案**

代码与数据分离，数据在 `data/` 子目录（.gitignore 排除）。

```
orbit/                          # 项目根目录（Git 仓库）
├── src/                        # 前端 + Server 代码
├── scripts/                    # 迁移脚本等工具
├── data/                       # 数据目录（.gitignore）
│   ├── diary/                  # 📖 日记
│   │   └── 2026-02-13.md
│   ├── messages/               # 💬 留言板
│   │   └── 2026-02-13.md
│   ├── letters/                # ✉️ 信箱
│   │   └── 2026-02-14.md
│   ├── memo/                   # 📌 备忘录
│   │   └── rules.md
│   ├── accounting/             # 💰 记账（待实现）
│   │   └── 2026-02.csv
│   └── assets/                 # 图片（内容寻址，扁平存储）
│       ├── a3f2c1d8.jpg
│       └── b7e4f920.jpg
├── README.md
├── MIGRATION_PLAN.md
└── .gitignore
```

Markdown 文件通过 frontmatter 区分类型，前端按 type 选择渲染组件：

```markdown
---
type: diary | message | letter | memo
date: 2026-02-13
author: 小辛星
---
```

图片方案（内容寻址）：
- 文件名 = SHA256 前 8 位 + 扩展名，天然去重
- 统一存入 `data/assets/`，扁平目录无子层级
- Markdown 统一引用 `![](assets/a3f2c1d8.jpg)`
- .md 文件无论在哪个子目录，图片路径不变，任意移动不影响
- Server 端对 `assets/` 路径统一 rewrite 到 `data/assets/`
- 上传时浏览器端压缩（80% quality），同时生成缩略图 `_thumb` 后缀

---

**编辑器选型：Milkdown**

- 所见即所得的 Markdown 编辑器，体验类似 Typora
- 输入输出原生 Markdown，无需格式转换
- 只加载基础语法 + 图片插件，轻量
- 内置图片上传钩子，对接本地 Server API
- 官方支持 React/Vue

---

**后续规划**

Bot 集成（Telegram / 飞书）：
- 通过 Bot 发图片+文字 → 自动生成 .md 并保存图片
- 支持指令查询（如 `/today`、`/summary 2月`）
- 需部署到公网服务器或用 Cloudflare Tunnel 内网穿透
- 当前架构无需改动即可支持

云端备份：
- 待定（Cloudflare R2 / 阿里云 OSS）

恋爱成长系统：
- 数据结构、存储格式待定

立体书 / 电子相册 / 电子书：
- 前端渲染库、导出格式待选型


定位：通用情侣恋爱记录平台，面向开源。
