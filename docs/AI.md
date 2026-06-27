# Orbit AI 集成设计方案

> v0.3 · 设计稿 · **MVP：站内流式聊天 + 会话持久化（默认私密，可开关共享）+ Tool Calling**
>
> SDK：**Vercel AI SDK**（`ai`）+ **Cloudflare Workers AI**（`workers-ai-provider`）
>
> 功能进度见 [ROADMAP.md](./ROADMAP.md#ai-能力phase-d)；架构背景见 [ARCHITECTURE.md](./ARCHITECTURE.md)。

---

## 1. 目标与范围

### 1.1 要做什么（MVP）

| 能力 | 说明 |
|------|------|
| 站内 AI 聊天 | 侧栏 / 浮层对话界面，流式输出 |
| **聊天持久化** | 会话列表 + 消息落库；**默认仅本人可见**；聊天框内可开关「与 TA 共享」 |
| 内容上下文 | 全局模式 + 关联当前文章模式 |
| 回忆检索 | 通过 Tool Calling 调用现有 FTS5 搜索与文章读取 |
| 模型配置 | 设置页选择 Provider；生产默认 Workers AI，可选 BYOK（OpenAI / Anthropic） |

### 1.2 本期不做

| 能力 | 原因 |
|------|------|
| 向量 RAG（Vectorize） | 已有 FTS5 + `bodyText`，情侣空间数据量小，MVP 够用 |
| 编辑器内联润色 | 复用同一 `/api/ai/chat`，单独排期 |
| 智能总结（日/周/月） | 用 `generateText` 非流式，二期 |
| MCP 端点 / API Token | Phase B，与站内 AI 共用 service 层但独立排期 |
| Cursor SDK | 外部 Agent 运行时，非站内聊天场景 |

### 1.3 非目标

- 不替代搜索引擎：AI 是「读懂 + 归纳」，检索仍走 FTS
- 不做多租户：情侣双人空间，无 per-user 模型配额细分（仅登录鉴权 + 简单限流）

---

## 2. 技术选型

### 2.1 分层关系

```
┌─────────────────────────────────────────┐
│  应用层：Vercel AI SDK（ai）             │
│  streamText · generateText · tools      │
│  前端 @ai-sdk/react useChat             │
├─────────────────────────────────────────┤
│  Provider 层                             │
│  ├─ workers-ai-provider → env.AI（默认） │
│  └─ @ai-sdk/openai / anthropic（BYOK）   │
├─────────────────────────────────────────┤
│  推理运行时                              │
│  Cloudflare Workers AI / 外部 API        │
└─────────────────────────────────────────┘
```

**Vercel AI SDK 与 Workers AI 不是二选一**：SDK 负责流式、Tool Calling、前端对接；Workers AI 是默认推理 Provider。

### 2.2 依赖

根目录 `package.json`：

```bash
npm i ai workers-ai-provider
# BYOK（二期可与 MVP 同期接入设置页）
npm i @ai-sdk/openai @ai-sdk/anthropic
```

前端 `web/package.json`：

```bash
npm i @ai-sdk/react
```

### 2.3 默认模型

| Provider | 默认模型 | 说明 |
|----------|----------|------|
| `workers-ai`（默认） | `@cf/zai-org/glm-4.7-flash` | 中文友好、支持 tool calling、131k ctx |
| `openai` / `anthropic`（BYOK） | 用户自选 | 设置页配置，质量优先场景 |

模型 ID 存 `settings` 表，可覆盖默认值。**本地与生产使用同一套 Provider 配置**，不因环境切换模型厂商。

---

## 3. 架构

### 3.1 请求流

```
浏览器 useChat（conversationId）
    │ GET /api/ai/conversations/:id     ← 打开面板时加载历史
    │ POST /api/ai/chat（cookie 鉴权）
    ▼
Hono createAiRoutes
    ├─ 校验 conversationId，加载历史 messages
    ├─ 写入 user message → ai_message
    ├─ readSettings → resolveModel(env)
    ├─ buildSystemPrompt(context)
    ├─ streamText({ model, messages, tools })
    │       ├─ tool: search_entries  → createSearchService
    │       ├─ tool: get_entry       → entry 查询
    │       └─ tool: list_memos      → memo 列表
    ├─ onFinish → 写入 assistant message（含 tool parts）
    └─ 更新 conversation.updatedAt / title（首条消息时）
    ▼
toDataStreamResponse() → 前端流式渲染
```

### 3.2 双模式运行与 Workers AI 接入

与 [ARCHITECTURE.md#双模式运行](./ARCHITECTURE.md#双模式运行) 一致：`src/api/ai.ts` 在 Node Server 与 Worker 间共享。

**本地完全可以走 Workers AI。** 分环境不是因为「本地不能用 CF 模型」，而是因为 **接入方式** 不同：

| 运行方式 | 入口 | Workers AI 怎么连 |
|----------|------|-------------------|
| 生产 Worker | `src/worker.ts` | `env.AI` binding（推荐，零 Key、低延迟） |
| 本地 `wrangler dev` | 同 worker 入口 | 同上，有 `env.AI` binding |
| 本地 Node（当前 `npm run server`） | `src/server/index.ts` | **无 binding** → `workers-ai-provider` REST（`accountId` + `apiKey`） |

```typescript
// resolveModel 统一逻辑：同一 provider，按可用性选连接方式
function createWorkersAiProvider(env?: Env) {
  if (env?.AI) {
    return createWorkersAI({ binding: env.AI });
  }
  // Node 本地：REST，凭证来自 env 或 wrangler secret
  return createWorkersAI({
    accountId: process.env.CF_ACCOUNT_ID!,
    apiKey: process.env.CF_API_TOKEN!,
  });
}
```

因此：

- **不需要**「本地 OpenAI、生产 Workers AI」这种按环境分叉 Provider 的策略
- **需要**的是 `resolveModel` 里 binding vs REST 的 fallback
- BYOK（OpenAI / Anthropic）是用户主动切换，与本地/生产无关

`resolveModel()` 是唯一分叉点；业务路由、tools、前端 UI 不分叉。

#### 本地开发选型（三选一，可并存）

| 方案 | 优点 | 缺点 |
|------|------|------|
| **A. Node + REST**（与现有 `npm run dev` 一致） | 不改 dev 流程；SQLite 直连 | 需配 `CF_ACCOUNT_ID` + `CF_API_TOKEN`；多一次 HTTP 到 CF API |
| **B. `wrangler dev`** | 与生产完全一致，有 `env.AI` | 本地 DB 走 D1 模拟，与当前 SQLite dev 流程不同 |
| **C. BYOK 外部模型** | 不依赖 CF 账号；模型质量可控 | 数据出境到 OpenAI/Anthropic |

**推荐**：日常开发用 **方案 A**（Node + REST Workers AI），与现有双模式架构最契合；CI 或联调前用 `wrangler dev` 验证 binding 路径。

### 3.3 目录结构（新增）

```
src/
  api/ai.ts                 # chat + conversations CRUD
  services/
    ai-model.ts             # resolveModel(settings, env)
    ai-prompt.ts            # system prompt 构建
    ai-tools.ts             # tool schema + execute
    ai-chat-store.ts        # 会话 / 消息读写
  db/schema.ts              # ai_conversation、ai_message 表
  app-settings.ts           # 扩展 AI 相关 setting keys

web/src/
  components/AiChatPanel.tsx
  components/AiConversationList.tsx
  lib/aiChat.ts             # useChat 封装（conversationId）
```

---

## 4. 配置与密钥

### 4.1 settings 表扩展

键名约定（`src/app-settings.ts`）：

| key | 类型 | GET 返回 | 说明 |
|-----|------|----------|------|
| `ai_provider` | `workers-ai` \| `openai` \| `anthropic` | 明文 | 默认 `workers-ai` |
| `ai_model` | string | 明文 | 可选，空则用 provider 默认 |
| `ai_openai_key` | 加密字符串 | **不返回**，仅 `hasOpenaiKey: boolean` | BYOK |
| `ai_anthropic_key` | 加密字符串 | **不返回**，仅 `hasAnthropicKey: boolean` | BYOK |

加密：服务端用 `BETTER_AUTH_SECRET` 派生密钥做 AES-GCM（或 libsodium），**明文 Key 永不落日志、不进审计 metadata**。

### 4.2 wrangler.toml

```toml
[ai]
binding = "AI"
```

`src/worker.ts` 的 `Env` 接口增加 `AI: Ai`。

### 4.3 环境变量

| 变量 | 用途 |
|------|------|
| `CF_ACCOUNT_ID` + `CF_API_TOKEN` | **本地 Node** 通过 REST 调 Workers AI（与生产同一模型） |
| `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` | BYOK fallback；或用户未在 settings 存 Key 时的运维兜底 |

生产 Worker 优先 `env.AI` binding，**不需要** CF API Token 即可推理。REST 凭证主要用于本地 Node dev。

### 4.4 设置页 UI

在 [Settings.tsx](../web/src/pages/Settings.tsx) 新增「AI」区块：

- Provider 单选：Cloudflare（默认）/ OpenAI / Anthropic
- API Key 密码框（保存后显示「已配置」，可清除）
- 可选：模型 ID 高级输入
- 保存走现有 `PUT /api/settings`，写审计 `settings.update`

---

## 5. 数据模型（会话持久化）

### 5.1 设计原则

| 原则 | 说明 |
|------|------|
| **默认私密** | 新建会话 `shared = false`，仅发起人 `userId` 在列表中可见 |
| **可选共享** | 发起人在聊天框内打开开关后 `shared = true`，对方可见且可续聊 |
| 归属与权限 | 发起人 = **所有者**；共享后双方可发消息，**仅所有者可**改共享开关、改标题、删除 |
| 用户消息署名 | `role=user` 的消息记录 `author`（小圆子 / 小麟子），共享线程中区分谁说的 |
| 软删除 | 会话支持 `deletedAt`；仅所有者可删 |
| AI SDK 兼容 | 消息存 `parts` JSON，对齐 `UIMessage`；往返不丢 tool call |
| 不存 system | system prompt 运行时生成，不入库 |

#### 可见性矩阵

| `shared` | 所有者 | 对方 |
|----------|--------|------|
| `false`（默认） | 看、聊、开关、删 | **不可见** |
| `true` | 看、聊、开关、删 | 看、聊；**不可**关共享或删除 |

关闭共享（`shared → false`）后，对方列表与详情**立即不可访问**（已有消息仍留在库中，仅对所有者可见）。

AI 检索范围不受共享开关影响：助手仍可搜索两人全部日记 / 备忘录等内容；共享只约束**聊天线程本身**的可见性。

### 5.2 表结构

定义于 `src/db/schema.ts`，迁移走 `drizzle-kit generate`。

#### `ai_conversation`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | UUID |
| `title` | text | 列表展示标题；首条 user 消息前 30 字，或「新对话 · MM-DD」 |
| `contextMode` | text | `global` \| `article` |
| `articleId` | text? | `contextMode=article` 时关联 `entry.id` |
| `userId` | text FK | 会话所有者 `user.id`（发起人） |
| `author` | text | 所有者规范名（小圆子 / 小麟子） |
| `shared` | integer | `0` \| `1`，默认 `0`；是否对情侣对方可见 |
| `createdAt` / `updatedAt` | integer | Unix 时间戳 |
| `deletedAt` | integer? | 软删除 |

索引：`idx_ai_conversation_user_updated` on `(userId, updatedAt)`；`idx_ai_conversation_shared` on `(shared, updatedAt)`（列共享会话）；`idx_ai_conversation_article` on `articleId`（可空）。

#### `ai_message`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | UUID |
| `conversationId` | text FK | → `ai_conversation.id`，级联删除 |
| `role` | text | `user` \| `assistant` \| `tool`（与 AI SDK 一致） |
| `author` | text? | 仅 `role=user` 时：小圆子 / 小麟子 |
| `parts` | text | JSON 序列化的 `UIMessage.parts`（含 text、tool-invocation 等） |
| `createdAt` | integer | Unix 时间戳 |

索引：`idx_ai_message_conversation` on `(conversationId, createdAt)`。

**不单独存 `content` 纯文本列**：以 `parts` 为唯一源，避免双写不一致。列表预览从 `parts` 提取首段 text。

### 5.3 写入时机

| 事件 | 动作 |
|------|------|
| 用户发送首条消息且无 `conversationId` | 创建 `ai_conversation`，返回新 id（响应头或 data stream metadata） |
| 用户发送消息 | 插入 `role=user` 的 `ai_message` |
| 流式结束 `onFinish` | 插入 `role=assistant` 的 `ai_message`（含完整 parts + tool results） |
| tool 中间步骤 | 合并进 assistant 的 `parts`，不单独落 `tool` 行（与 AI SDK 默认行为一致） |
| 删除会话 | 仅所有者：`deletedAt = now()` |
| 切换共享 | 仅所有者：`PATCH { shared }`；`true` 时写 `updatedAt` 便于对方列表排序 |

### 5.4 容量与裁剪

情侣空间数据量小，MVP **不做**消息条数上限。预留策略（二期）：

- 单会话超过 100 条时，UI 提示「新开对话」
- 发给模型的 context：最近 N 条 + 首条摘要（summarization）

---

## 6. API 设计

### 6.1 `POST /api/ai/chat`

**鉴权**：`requireAuth`（与现有 API 一致，cookie session）。

**请求体**：

```typescript
interface AiChatRequest {
  conversationId?: string;         // 空则首条消息时自动创建
  messages: UIMessage[];           // 客户端当前消息；服务端以 DB 为准合并
  context?: {
    mode: "global" | "article";
    articleId?: string;            // mode=article 时必填
  };
}
```

**服务端消息合并**：若带 `conversationId`，从 DB 加载该会话全部 `ai_message` 转为 `UIMessage[]`，再 append 请求中**最新一条** user 消息（防客户端篡改历史）。若无 `conversationId`，用请求 `messages` 中最后一条 user 消息开新会话。

**响应**：`text/event-stream`（AI SDK Data Stream），`result.toDataStreamResponse()`。

响应头（或 stream 首包 metadata）返回 `X-Conversation-Id`，供前端 `useChat` 绑定会话。

**错误码**：

| 状态 | 场景 |
|------|------|
| 401 | 未登录 |
| 400 | messages 无效、articleId 缺失 |
| 404 | conversationId 不存在、已软删，或**无权限**（他人私密会话） |
| 403 | 非所有者尝试删除 / 改共享 / 改标题 |
| 422 | Provider 已选但 Key 未配置 |
| 429 | 限流 |
| 502 | 上游模型错误（附简短中文说明） |

### 6.2 会话 CRUD

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/ai/conversations` | 见下方列表规则 |
| POST | `/api/ai/conversations` | 显式新建（`shared` 默认 false） |
| GET | `/api/ai/conversations/:id` | 元数据 + messages；须有权访问 |
| PATCH | `/api/ai/conversations/:id` | 所有者：`title`、`shared` |
| DELETE | `/api/ai/conversations/:id` | 仅所有者软删除 |

**列表规则** `GET /api/ai/conversations`：

```sql
-- 逻辑等价
WHERE deleted_at IS NULL
  AND (
    user_id = :currentUserId
    OR (shared = 1 AND user_id != :currentUserId)  -- 对方共享给我的
  )
ORDER BY updated_at DESC
```

可选 `?articleId=` 筛文章上下文会话。

列表项返回：

```typescript
{
  id: string;
  title: string;
  contextMode: "global" | "article";
  articleId?: string;
  shared: boolean;
  isOwner: boolean;           // 是否本人创建
  ownerAuthor: string;        // 小圆子 | 小麟子
  updatedAt: number;
  preview: string;            // 最后一条消息摘要 ≤80 字
}
```

非所有者看到的共享会话：`isOwner: false`，列表展示「{ownerAuthor} 共享」角标。

### 6.3 限流（MVP）

- 每登录用户：**20 次 / 分钟**（内存计数或 KV，MVP 可用进程内 Map + 滑动窗口）
- 单次请求：**maxSteps 5**（tool 循环上限，防 agent 死循环）
- 单次 tool 返回：**截断至 8k 字符**（防 context 爆炸）

### 6.4 二期端点（预留，本期不实现）

| 端点 | 用途 |
|------|------|
| `POST /api/ai/generate` | 非流式，智能总结 |

---

## 7. System Prompt

`buildSystemPrompt(context)` 职责：

1. **身份**：Orbit 情侣空间助手，语气温暖、简洁，用中文
2. **作者规范**：小圆子 / 小麟子（与 [ARCHITECTURE.md#作者规范](./ARCHITECTURE.md#作者规范) 一致）
3. **能力说明**：可搜索日记、时间线、留言、信件、备忘录；不确定时先 `search_entries`
4. **隐私**：不编造未检索到的内容；引用时说明来源标题与日期
5. **context=article**：注入当前文标题、`entryDate`、作者、`bodyText` 摘要（全文过长则截断 + 提示可用 `get_entry`）

不在 system 里塞全库数据；靠 tools 按需拉取。

---

## 8. Tool Calling

定义于 `src/services/ai-tools.ts`，通过 `createAiTools(db)` 工厂注入 db。

### 8.1 `search_entries`

```typescript
{
  query: string;      // 搜索词，≥1 字符
  type?: "diary" | "timeline" | "message" | "letter" | "memo";
  limit?: number;     // 默认 5，最大 10
}
```

实现：复用 `createSearchService(db).search()`（[src/services/search.ts](../src/services/search.ts)）。

返回：`(id, type, title, entryDate, snippet)[]`。

### 8.2 `get_entry`

```typescript
{ id: string }
```

返回：`title`、`type`、`author`、`entryDate`、`bodyText`（strip HTML，上限 12k 字符）。

软删除条目返回「不存在」。

### 8.3 `list_memos`

```typescript
{ limit?: number }   // 默认 20
```

返回：`(key, title, updatedAt)[]`，不含全文。

### 8.4 权限

- 所有 tool 仅对已登录情侣账号开放
- 数据范围 = 整个空间（双人共享），不做 author 过滤（除非用户明确要求「只看小圆子写的」——由模型在 search 后过滤）

---

## 9. 前端

### 9.1 布局

`AiChatPanel` 分两栏（桌面）或两步（移动）：

```
┌─────────────────┬──────────────────────────────┐
│ 我的对话         │ 当前对话                      │
│ · 昨天聊旅行     │ [开关] 与 TA 共享此对话        │  ← 仅所有者可见开关
│ · 小麟子共享     │ [user] 帮我找...              │
│ [+ 新对话]       │ [输入框]                      │
└─────────────────┴──────────────────────────────┘
```

移动：先列表 Sheet，点进会话后全屏聊天；顶部返回列表 + 共享开关（所有者）。

### 9.2 组件

`AiChatPanel.tsx`：

| 区域 | 行为 |
|------|------|
| **共享开关** | 聊天框顶栏；仅 `isOwner`；默认关；打开前 confirm「对方将看到完整对话」 |
| 会话列表 | 自己的会话 + 对方 `shared` 的会话；非自有项显示 `{ownerAuthor} 共享` |
| 新对话 | 清空 `conversationId`；`shared` 默认 false |
| 消息列表 | 用户气泡显示 `author`；共享会话中可区分两人发言 |
| 输入框 | 所有者任意聊；共享会话**双方**均可发送 |
| 上下文指示 | 「全局」或当前文章标题 |
| 空态 | 示例：「帮我找去年夏天的日记」 |
| 未配置 | Provider 需 Key 时引导 `/settings` |

`AiConversationList.tsx`：拉列表；所有者项可删除；共享项只读无删除。

### 9.3 入口

| 位置 | context |
|------|---------|
| `Layout.tsx` 全局按钮 | `mode: global` |
| `ArticleView.tsx` 文章内按钮 | `mode: article`, `articleId` |

桌面：右侧浮层（宽 360–400px）；移动：全屏 Sheet。样式遵循 [DESIGN.md](../DESIGN.md)。

文章页打开面板时：`?articleId=` 筛会话列表，新对话默认 `contextMode=article`。

### 9.4 useChat 与持久化

```typescript
const [conversationId, setConversationId] = useState<string | undefined>();

// 选中会话时加载历史
useEffect(() => {
  if (!conversationId) return;
  fetch(`/api/ai/conversations/${conversationId}`, { credentials: "include" })
    .then((r) => r.json())
    .then((data) => setMessages(data.messages));
}, [conversationId]);

const { messages, setMessages, append, isLoading } = useChat({
  api: "/api/ai/chat",
  credentials: "include",
  id: conversationId,                    // 稳定会话 key
  body: { conversationId, context },
  onResponse(res) {
    const id = res.headers.get("X-Conversation-Id");
    if (id && !conversationId) setConversationId(id);
  },
});
```

首条消息自动建会话后，刷新列表；续聊时服务端从 DB 拼 history。

**共享开关**（所有者）：

```typescript
async function setShared(conversationId: string, shared: boolean) {
  await fetch(`/api/ai/conversations/${conversationId}`, {
    method: "PATCH",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ shared }),
  });
}
```

开关用受控组件；`shared` 从 `GET /api/ai/conversations/:id` 同步。关闭共享后对方若正打开该会话，下次请求返回 404。

---

## 10. 安全与审计

| 项 | 策略 |
|----|------|
| 鉴权 | 所有 `/api/ai/*` 走 `requireAuth`；读写会话校验所有者或 `shared` |
| Key 存储 | 加密落库；响应脱敏 |
| 日志 | 不记录 messages 全文、不记录 API Key；`createLogger("ai")` 仅记 requestId、provider、durationMs、tool 名 |
| 审计 | 会话删除可写 `audit_log`（`ai.delete`）；**单条消息内容不进审计**；settings 变更走现有审计 |
| 内容出境 | BYOK 时数据发往用户选择的厂商；Workers AI 时数据在 CF 边缘推理 |

---

## 11. 实现阶段

### Phase 1 — 骨架（可 curl 验证）

- [ ] 依赖安装、`wrangler.toml` `[ai]`、`Env.AI`
- [ ] `ai_conversation` / `ai_message` 表 + migration
- [ ] `src/services/ai-chat-store.ts`：CRUD + message 序列化
- [ ] `src/services/ai-model.ts`：`resolveModel`
- [ ] `src/api/ai.ts`：`POST /chat` 流式 + 自动建会话 + `onFinish` 落库
- [ ] 挂载到 `worker.ts` + `server/index.ts`

### Phase 2 — 配置

- [ ] `app-settings.ts` 扩展 + settings API + 加密存储
- [ ] 设置页 AI 区块

### Phase 3 — 能力

- [ ] `ai-tools.ts` 三个 tool
- [ ] `ai-prompt.ts` + article context 注入
- [ ] 限流
- [ ] `GET/PATCH/DELETE /api/ai/conversations`（含 `shared` 权限）

### Phase 4 — UI

- [ ] `AiConversationList` + `AiChatPanel` + **共享开关** + Layout / ArticleView 入口
- [ ] 加载历史、新对话、删除会话
- [ ] 错误态、加载态

### Phase 5 — 文档与 ROADMAP

- [ ] ROADMAP AI 行状态更新
- [ ] ARCHITECTURE 表结构补充
- [ ] CHANGELOG（随 release 流程）

---

## 12. 测试计划

| 场景 | 验证 |
|------|------|
| 生产 Worker + Workers AI binding | 流式回复、中文正常 |
| 本地 Node + Workers AI REST | 与生产同一模型，流式正常 |
| 本地 `wrangler dev` + binding | 与生产路径一致 |
| BYOK（openai / anthropic） | 任意环境均可 |
| 首条消息自动建会话 | 响应含 `X-Conversation-Id`，DB 有记录 |
| 刷新后续聊 | 同一 conversationId 历史完整 |
| 默认私密 | 小麟子看不到小圆子的未共享会话 |
| 打开共享 | 小麟子列表出现「小圆子共享」；可读可续聊 |
| 关闭共享 | 对方随后访问该会话 404 |
| 非所有者删/关共享 | 403 |
| 共享会话双方发言 | 气泡 `author` 正确 |
| 所有者软删除 | DELETE 后会话双方列表均不可见 |
| `context=article` | system 含当前文信息；可按 articleId 筛会话 |
| `search_entries` | 「找提到某某的日记」能召回 FTS 结果 |
| 未配置 Key + openai provider | 422 + 前端引导设置 |
| 限流 | 连续请求触发 429 |
| `prefers-reduced-motion` | 聊天 UI 无多余动效（与 DESIGN 一致） |

---

## 13. 后续演进（非 MVP）

| 方向 | 方案 |
|------|------|
| 长会话裁剪 | 超 100 条摘要旧消息再发给模型 |
| 向量检索 | Workers AI embedding + Vectorize；FTS 作 hybrid 召回 |
| 编辑润色 | TipTap 选中 → 同一 chat 端点，system 换「润色助手」 |
| 智能总结 | `generateText` + 日期范围聚合 entry |
| AI Gateway | CF AI Gateway 统一代理 BYOK，缓存与观测 |
| MCP | `@modelcontextprotocol/sdk`，tools 与 `ai-tools` 共用底层 service |

---

## 14. 相关文档

| 文档 | 用途 |
|------|------|
| [ROADMAP.md](./ROADMAP.md) | AI 功能状态与优先级 |
| [ARCHITECTURE.md](./ARCHITECTURE.md) | 双模式、表结构、搜索 |
| [DESIGN.md](./DESIGN.md) | 聊天 UI 视觉规范 |
| [Cloudflare Workers AI + AI SDK](https://developers.cloudflare.com/workers-ai/configuration/ai-sdk/) | Provider 官方集成说明 |
