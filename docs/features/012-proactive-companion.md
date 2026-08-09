# 主动陪伴与问候设计规范 (Proactive Companion)

> 本文档规范 Orbit 主动陪伴与问候系统的设计与实现，旨在提供“润物无声”的陪伴体验，在合适的时间通过合适的方式向两人递送回忆与关怀。
> 创建：2026-07-26

状态：📋 规划中

---

## 1. 定位与设计哲学

Orbit 是双人专属的私密空间，设计语言强调 **“Restrained & Romantic”（克制与浪漫）**。主动陪伴系统必须严格遵循以下原则：

1. **润物无声（Zero Noise & No Pressure）**
   - 拒绝打卡式催促与内疚感驱动（如“你们已经 X 天没有写日记了”）。
   - 默认采用静默与极简推送；在无明确契机时，**静默是最好的陪伴**。

2. **真实温情（Fact-Based Warmth）**
   - AI 在生成陪伴短文案时，必须严格基于二人真实的日记、信件、留言与纪念日节点。
   - **禁止编造**未在空间中出现的事件或虚假细节。

3. **完全可控（User Control & Respect）**
   - 用户可随时在设置面板选择开启/关闭各类陪伴主题，配置安静时段与接收频次。

---

## 2. 场景矩阵

系统定义四大核心陪伴场景：

| 场景名称 | 契机条件 | 陪伴内容与形式 | 默认频率 / 时段 |
| --- | --- | --- | --- |
| **回忆的回声 (Memory Echo)** | 去年的今天、半年前的今天，或随机精选一条历史高分/长篇日志、信件 | 摘录当年原文片段，配以温暖回顾引导 | 1~2 次 / 周<br/>09:00 - 21:30 随机 |
| **节点的轻提醒 (Milestones)** | 恋爱纪念日、生日、相识 N 百天等节点提前 3 天及当天 | 温和的节日与纪念日提示卡片，预留准备仪式感的时间 | 提前 3 天 1 次，当天 1 次<br/>09:00 提醒 |
| **信件与留言沉淀 (Gentle Digest)** | 对方发布了长信件或重要留言，且在 6 小时内未被阅读 | 优雅提醒 TA 留下了封信，提示去空间读取 | 触发式<br/>主窗口 18:00 - 21:30；若错过，次日 19:00 - 21:30 补送一次 |
| **空间周记忆回顾 (Weekly Reflection)** | 每周日傍晚，且当周双方有 ≥3 条新记录或总字数 > 500 字 | 汇总当周的记录点滴，提炼温馨词云或摘要卡片 | 1 次 / 周<br/>周日 19:30 |

---

## 3. 架构与流程设计

整体架构由 **Cloudflare Workers Cron Trigger** 驱动调度，经过 **决策引擎过滤**、**数据抽取与 AI 润色**，最后进行 **防骚扰校验与卡片投递**。

```
┌─────────────────────────────────────────────────────────────┐
│              Cloudflare Workers Cron Trigger                │
└──────────────────────────────┬──────────────────────────────┘
                               │ 1) 定时触发调度 (如每小时/每日固定点)
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 陪伴决策引擎 (Companion Engine)              │
│  - 匹配契机节点 (纪念日 / 去年的今天 / 沉淀未读)                │
│  - 评估契机质量评分 (Score > Threshold)                      │
└──────────────────────────────┬──────────────────────────────┘
                               │ 2) 命中有效契机
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 数据抽取与 AI 润色模块                       │
│  - 提取原始文献片段 (Diary / Letter / Milestone)             │
│  - Workers AI / DeepSeek 生成润色短文案 (Strict Fact Control)│
└──────────────────────────────┬──────────────────────────────┘
                               │ 3) 生成卡片 Payload
                               ▼
┌─────────────────────────────────────────────────────────────┐
│                 防骚扰与投递控制 (Delivery Guard)            │
│  - 检查用户偏好设置 (Notifications Settings)                 │
│  - 安静时段拦截 (Quiet Hours: 22:30 - 08:30)                  │
│  - 频次与历史去重校验 (Dedup Log)                             │
└──────────────────────────────┬──────────────────────────────┘
                               │ 4) 执行投递
                               ▼
                ┌──────────────┴──────────────┐
                ▼                             ▼
        [飞书 Interactive Card]        [站内 Notification Panel]
```

---

## 4. 核心逻辑规范

### 4.1 契机评分与过滤机制 (Decision Scoring)

并不是所有历史记录都适合主动推送。系统按以下规则评分，仅当得分分值达到门槛时才列为候选：

* **基础权重**：
  * 去年的今天：+50 分
  * 相识/恋爱整百整周年节点：+60 分
  * 文章包含双方 Marginalia 互动/评论：+20 分
  * 文章文本字数 > 300 字：+10 分
* **扣分与拦截项**：
  * 近 30 天内已作为“回忆回声”推送过：-100 分（直接排除）
  * 处于用户设置的安静时间窗（Quiet Hours）：-100 分
* **候选门槛**：总分 ≥ 50 分方可进入候选队列，低于门槛的记录本轮跳过。

### 4.2 场景优先级排序 (Scene Priority)

当同一天多个场景同时命中时，因每日每用户最多投递 **1 条**推送，按以下优先级取最高级别场景执行，其余候选记录为 `skipped`：

```
Milestone > Memory Echo > Weekly Reflection > Gentle Digest
```

> **说明**：纪念日是强时效性节点，优先级最高；Memory Echo 次之，作为常规情感维系；Weekly Reflection 固定周期，再次之；Gentle Digest 属于被动触发补充，优先级最低。若 Milestone 当天已推送，Memory Echo 顺延至次日第一个空窗期投递。

### 4.3 安静时段定义 (Quiet Hours)

系统统一以 **`22:30 ~ 08:30`** 作为安静时段，任何场景在此时间窗内均不触发投递，已生成的卡片延后至次日 08:30 后的第一个合法时间窗。用户可在设置面板覆盖此默认值。

> **时区处理**：文档中所有时间均以**用户所在时区**为准。Cloudflare Workers Cron 默认运行在 UTC，调度逻辑需在 Worker 内部将 UTC 时间转换为用户本地时区后再做时间窗判断。用户时区从 Space 配置或用户 Profile 读取，缺省使用 `Asia/Shanghai`。

### 4.4 AI Prompt 约束与安全边界

AI 仅用于文案润色与提炼，**严禁引入幻想背景**：

```text
[System Prompt]
你是一个温柔、克制的空间文字助理。你的任务是根据提供的二人真实历史记录，生成一句简短有温度的引言。
规则：
1. 必须完全基于提供的输入文本，严禁编造或推测未提及的细节。
2. 字数控制在 30~60 字以内，风格典雅、克制，符合 Orbit 暖石风格。
3. 如果输入记录较少，直接输出原句摘录，不要过度修饰。
```

### 4.5 防骚扰与节流策略 (Delivery Guard)

1. **安静时段 (Quiet Hours)**：见 Section 4.3，默认 `22:30 ~ 08:30`，已生成的卡片延后至次日合法窗口投递。
2. **总量上限 (Quota Limit)**：
   - 每位用户/每个空间每日最多接收 **1 条** 主动陪伴卡片推送。
3. **已读与交互感知**：
   - 若用户当天已频繁登录并浏览了该条旧记录，系统自动跳过该记录的推送。

---

## 5. 数据结构与 Schema 演进

需新增 `companion_log` 表以记录主动推送历史与去重状态：

```sql
-- 主动陪伴推送记录与去重表
CREATE TABLE `companion_log` (
  `id` text PRIMARY KEY NOT NULL,
  `space_id` text NOT NULL,
  `recipient_user_id` text NOT NULL,
  `type` text NOT NULL, -- 'memory_echo' | 'milestone' | 'digest' | 'weekly_reflection'
  `target_id` text,      -- 关联资源 ID，语义因 type 而异：
                         --   memory_echo:       diary/letter 的 entry_id
                         --   milestone:         milestone 表的 id（无单一文章时可为 null）
                         --   digest:            触发推送的 letter/message 的 entry_id
                         --   weekly_reflection: null（周维度聚合，无单一 target）
  `payload` text,        -- 存入的卡片文案 JSON
  `status` text NOT NULL, -- 'sent' | 'skipped' | 'failed'
  `created_at` integer NOT NULL,
  FOREIGN KEY (`recipient_user_id`) REFERENCES `user`(`id`)
);

CREATE INDEX `idx_companion_dedup` ON `companion_log` (`space_id`, `recipient_user_id`, `target_id`, `created_at` DESC);
```

> 索引将 `recipient_user_id` 纳入，使「某用户最近 N 天是否推过该 target」的去重查询更高效。

数据表应用到 `src/db/schema.ts` 并生成 D1 迁移文件。

---

## 6. 飞书卡片视觉规范 (Card Design)

根据 [DESIGN.md](../DESIGN.md)，陪伴卡片不使用大红大绿与浮夸按钮，采用**暖石微调排版与极简交互**：

* **Header**：优雅短标题，如 `旧时回忆 · 1 年前的今天` 或 `纪念日预告`
* **Content**：
  * 摘录背景设为轻量文本块。
  * 精选 1~2 句摘录文本（Serif/Songti 意象）。
* **Action**：
  * 单一低调动作按钮：`[回到 Orbit 查看详情]`
  * 点击跳转至目标文章路由或纪念日页面。

---

## 7. 演进与开发路线图

- [ ] **Phase 1: 基础设施**
  - 在 `wrangler.toml` 中配置 Worker Cron trigger 为每小时调度（`0 * * * *`），Worker 内部按用户时区判断当前时间是否落在各场景的合法投递窗口，再决定是否执行推送。
  - 创建 `companion_log` 表及相应 D1 迁移文件。
- [ ] **Phase 2: 陪伴引擎实现**
  - 实现 `src/services/companion-engine.ts`：契机扫描、评分与去重逻辑。
  - 实现纪念日与“去年的今天”检索函数。
- [ ] **Phase 3: AI 润色与飞书卡片**
  - 实现卡片构建器 `src/services/feishu-companion-card.ts`。
  - 接入 Workers AI / DeepSeek 进行短文案轻量生成。
- [ ] **Phase 4: 前端设置与开关**
  - 在 `/settings?tab=notifications` 扩展陪伴推送细粒度控制面板。
