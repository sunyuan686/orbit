# 空间开通与署名设计

> 将 Orbit 从「单实例写死小圆子 / 小麟子」泛化为任意情侣可开箱使用。  
> 进度总览见 [ROADMAP.md](./ROADMAP.md)（Phase A #10 可配置署名、#11 邀请加入）。

---

## 目标

| 现状 | 目标 |
|------|------|
| `CANONICAL_AUTHORS` 硬编码两人名 | 每对情侣注册时**各自填写**爱称 |
| 部分表缺 `user_id`（如 `memo`） | **凡涉及人员的表均具备 `user_id`** |
| 权限比对 `author` 字符串 | 权限、通知收件等比对 **`user_id`** |
| 注册页二选一「小圆子 / 小麟子」 | 自由输入，互斥校验 |
| 第二人可走公开注册 | 第一人注册后关闭公开注册，**仅邀请链接**可加入 |

**非目标（MVP）**：邮件发邀请、历史叫法快照、删除 `author` 列、多租户。

---

## 已锁定产品决策

| 项 | 决策 |
|----|------|
| 爱称设定 | 各自注册时自填；注册后可在设置中**修改** `user.name` |
| 作者身份 | `user.id` → 各表 `user_id`（或 `recipient_user_id` / `actor_user_id`） |
| 作者展示 | 读取时按 `user_id` JOIN `user.name`；**不做**历史叫法快照 |
| `author` 文本列 | **保留、继续写入**（写入时同步当前 `user.name`）；**不删除**；展示与权限**不依赖**此列 |
| 双写规则 | 人员相关列均 **id + 文本** 双写：`user_id` + `author`；`modified_by_user_id` + `modified_by`；通知同理 |
| 邀请形式 | 生成链接 → 复制发送 |
| 存量实例 | DDL + 按 `author` 回填缺失的 `user_id` / `*_user_id` |
| settings 存署名 | **不存** |

---

## 核心概念

### 作者：身份 vs 展示 vs 冗余列

| 层 | 字段 | 是否可变 | 用途 |
|----|------|----------|------|
| 身份 | `user_id` | 永不改 | 权限、通知关联、飞书映射、展示 resolve 的键 |
| 展示（爱称） | `user.name` | **可编辑** | JOIN 得到 `authorName` |
| 冗余 | `author` 等文本列 | 写入时快照 | FTS、搜索 snippet、兼容旧读路径；**展示不读此列** |

写入示例：

```ts
await db.insert(entry).values({
  userId: session.userId,
  author: session.author,
  modifiedByUserId: session.userId,
  modifiedBy: session.author,
  // ...
});

await db.update(entry).set({
  modifiedByUserId: session.userId,
  modifiedBy: session.author,
  // ...
});
```

读取展示：

```ts
const authorName = userMap[row.userId]?.name ?? row.author ?? "未知";
const modifiedByName =
  row.modifiedByUserId != null
    ? userMap[row.modifiedByUserId]?.name ?? row.modifiedBy ?? null
    : null;
```

爱称修改后：冗余文本列可保持旧字符串；展示随 `user.name` 更新（resolve 走 `*_user_id`）。

### 空间作者列表

```ts
interface SpaceAuthor {
  id: string;
  name: string;
}

async function getSpaceAuthors(db): Promise<SpaceAuthor[]> {
  return db
    .select({ id: user.id, name: user.name })
    .from(user)
    .orderBy(user.createdAt)
    .limit(2);
}
```

### 空间状态

| `user` 数量 | 状态 | 公开注册 | 邀请 |
|-------------|------|----------|------|
| 0 | 空置 | 允许 | 不可用 |
| 1 | 待伴侣 | **关闭** | 可生成邀请 |
| 2 | 已满 | **关闭** | 不可用 |

---

## 数据模型变更（DDL）

### 新增表 `space_invite`

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | text PK | `inv_` 前缀 |
| `token` | text UNIQUE | 邀请 token |
| `created_by` | text FK → user.id | 发起人 |
| `expires_at` | integer | 默认 7 天 |
| `used_at` | integer NULL | 已接受时间 |
| `created_at` / `updated_at` | integer | |

迁移：`0011_space_invite.sql`

### 补列：`entry` / `memo` — 编辑者

```sql
ALTER TABLE entry ADD modified_by_user_id text REFERENCES user(id);
ALTER TABLE memo ADD modified_by_user_id text REFERENCES user(id);
ALTER TABLE memo ADD user_id text REFERENCES user(id);
```

`modified_by` 文本列**保留、继续双写**；展示「最后编辑者」由 `modified_by_user_id` → `user.name` resolve。

创建时：`modified_by_user_id` 与 `user_id` 同为创建者；每次更新写入当前 session 的 `userId` + `user.name`。

### 补列：`notification`

```sql
ALTER TABLE notification ADD recipient_user_id text REFERENCES user(id);
ALTER TABLE notification ADD actor_user_id text REFERENCES user(id);
```

保留原有 `recipient`、`actor` 文本列，继续双写当前爱称。

### 补列：`ai_message.user_id`

```sql
ALTER TABLE ai_message ADD user_id text REFERENCES user(id);
```

`role = 'user'` 时写入 `user_id` + `author` 双写；`assistant` / `tool` 消息 `user_id` 为 NULL。

### 已有人员列、仅需保证双写的表

| 表 | 创建者 | 编辑者 |
|----|--------|--------|
| `entry` | `user_id` + `author`（已有） | **新增** `modified_by_user_id` + `modified_by`（已有） |
| `comment` | `user_id` + `author` | — |
| `audit_log` | `user_id` + `author` | — |
| `ai_conversation` | `user_id` + `author` | — |

### 明确不做

| 项 | 说明 |
|----|------|
| 删除 `author` / `modified_by` 等文本列 | 保留双写 |

---

## 涉及人员的表（清单）

实现与 migration 须覆盖下表。**凡有人员文本列，均应有对应 `*_user_id` 并双写。**

| 表 | 身份列 | 冗余文本列 | DDL |
|----|--------|------------|-----|
| `entry` | `user_id`, `modified_by_user_id` | `author`, `modified_by` | **新增 `modified_by_user_id`** |
| `memo` | `user_id`, `modified_by_user_id` | `author`, `modified_by` | **新增 `user_id`、`modified_by_user_id`** |
| `comment` | `user_id` | `author` | 无 |
| `audit_log` | `user_id` | `author` | 无 |
| `ai_conversation` | `user_id` | `author` | 无 |
| `ai_message` | `user_id` | `author` | **新增 `user_id`** |
| `notification` | `recipient_user_id`, `actor_user_id` | `recipient`, `actor` | **新增两列** |

---

## 存量数据迁移

| 步骤 | 操作 |
|------|------|
| 1 | 执行上述 DDL |
| 2 | `entry` / `memo`：按 `author` 回填 `user_id`；按 `modified_by`（缺省用 `author`）回填 `modified_by_user_id` |
| 3 | `memo`：缺 `user_id` 的行按 `author` 回填 |
| 4 | `comment`：缺 `user_id` 的行按 `author` 回填 |
| 5 | `notification`：按 `recipient` / `actor` 回填 `*_user_id` |
| 6 | `ai_message`：`role = 'user'` 行按 `author` 回填 `user_id` |
| 7 | **不批量修改** 各表 `author` / `modified_by` 等文本内容 |

---

## API

### 响应中的作者

```json
{
  "id": "ent_xxx",
  "userId": "usr_aaa",
  "authorName": "阿树",
  "author": "阿树",
  "modifiedByUserId": "usr_bbb",
  "modifiedByName": "小鹿",
  "modifiedBy": "小鹿"
}
```

- `authorName` / `modifiedByName`：由 `*_user_id` → `user.name` resolve（**展示用**）
- `author` / `modifiedBy`：库内冗余列；前端**以 `*Name` 为准**
- 无编辑时 `modifiedByUserId` 可与 `userId` 相同，或 `modifiedByName` 省略

### `PUT /api/account/profile`

```json
{ "name": "新爱称" }
```

- 仅更新 `user.name`
- **不**回溯更新各表 `author` 列
- 审计：`account.profile.update`

其余接口（`GET /api/space/status`、invite 等）同前。

---

## 认证与权限

- 注册门禁、邀请流程：同前。
- **权限只认 `user_id`**，不认 `author` 字符串。
- `notify`：写入 `recipient_user_id` / `actor_user_id`，并双写 `recipient` / `actor` 爱称。

---

## 爱称校验

| 规则 | 说明 |
|------|------|
| 长度 | 1–16 字符（trim 后） |
| 唯一 | 与同空间另一 `user.name` 不可相同 |
| 存储 | `user.name` |

---

## 下游改造要点

| 模块 | 改动 |
|------|------|
| `src/api/articles.ts` | 创建/更新双写 `user_id`+`author`、`modified_by_user_id`+`modified_by`；resolve `authorName` / `modifiedByName` |
| `src/api/comments.ts` | 双写 `user_id` + `author`；resolve `authorName` |
| memo 相关 API | 双写创建者与编辑者 id + 文本 |
| `ArticleMetadata.tsx` | 展示 `modifiedByName`（来自 API resolve） |
| `src/services/notify.ts` | 写 `recipient_user_id` / `actor_user_id` + 双写爱称 |
| `src/content-policies.ts` | 权限比 `userId` |
| `feishu-*` | open_id 映射 key 为 `user.id` |
| FTS / 搜索 | 可继续索引 `author` 冗余列 |

---

## 实施阶段

### Phase 0 — Schema + 回填

1. migration：`space_invite`；`memo.user_id`；`entry`/`memo.modified_by_user_id`；`notification.*_user_id`；`ai_message.user_id`
2. 存量回填脚本
3. 全写入路径双写；读展示 resolve `authorName` / `modifiedByName`
4. 权限 / notify / feishu 改认 `user_id`

### Phase 1 — 开通与爱称（#10）

同前。

### Phase 2 — 邀请（#11）

同前。

### 验收标准

- [ ] 各表新写入均含 id + 文本双写（含 `modified_by_user_id`）
- [ ] `memo`、`notification`、`ai_message`、编辑者列回填正确
- [ ] 改爱称后 `authorName` / `modifiedByName` 更新，冗余文本列可为旧值
- [ ] 权限与通知按 `user_id` 正确
- [ ] 存量实例升级无感

---

## 文档联动

| 变更 | 更新 |
|------|------|
| 本功能上线 | [ROADMAP.md](./ROADMAP.md) |
| 表结构 | [ARCHITECTURE.md](./ARCHITECTURE.md) |
| 飞书 | [FEISHU.md](./FEISHU.md) |

---

## 后续扩展（未排期）

- 邮件发邀请
- 邀请撤销
