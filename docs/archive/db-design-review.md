# 数据库表设计 Review

> ⚠️ **历史文档**：部分建议已采纳（如仅存 `storage_key`、FTS5 虚拟表、去掉 `body_html`）。
> 当前表结构以 [ARCHITECTURE.md](../ARCHITECTURE.md) 与 `src/db/schema.ts` 为准。
>
> 基于 [alignment-plan.md](./alignment-plan.md) 中的 4 张表设计（entry / asset / memo / settings）

---

## 一、需要修正的问题

### 1. `body` / `body_html` / `body_text` 三份冗余数据，同步风险高

`entry` 表同时存了 Markdown 原文、预渲染 HTML、纯文本三份内容：

```sql
body         TEXT,   -- Markdown 原文
body_html    TEXT,   -- 预渲染 HTML（展示用）
body_text    TEXT,   -- 纯文本（全文搜索索引）
```

**问题**：每次 `UPDATE body` 都必须同步更新另外两个字段，遗漏就会出现"前端显示旧内容"的 bug。

**建议**：
- `body_html`：去掉，在读取时由服务端实时渲染（Hono 层），或者加一个触发器 / 写入时必须同步更新
- `body_text`：D1 支持 FTS5 虚拟表，可用 `CREATE VIRTUAL TABLE entry_fts USING fts5(...)` 代替手动维护的 `body_text` 字段

---

### 2. `asset.url` 硬存公网 URL，迁移风险大

```sql
url  TEXT NOT NULL,  -- 公网访问 URL
```

**问题**：如果 R2 自定义域名变更（比如从 `assets.orbit.app` 换成 `media.orbit.app`），所有历史记录的 URL 都要批量更新，且 `entry.body` 里内嵌的图片链接也要同步处理，极难维护。

**建议**：只存 `storage_key`（R2 object key），公网 URL 在读取时由配置文件中的 `ASSETS_BASE_URL` 拼接生成：

```ts
const url = `${env.ASSETS_BASE_URL}/${asset.storage_key}`
```

---

### 3. `asset` 表缺少级联软删除设计

`entry` 有 `deleted_at` 软删除，但 `asset` 没有：

```sql
-- entry 有软删除
deleted_at   INTEGER

-- asset 没有
-- 当 entry 被软删除时，关联图片怎么处理？
```

**问题**：entry 软删除后，R2 上的图片和 asset 记录都会变成孤儿数据，既浪费存储，又无法清理。

**建议**：`asset` 表加 `deleted_at`，entry 软删除时联动标记。

---

## 二、建议优化的问题

### 4. `author` 字段是裸字符串，未关联用户表

```sql
author  TEXT NOT NULL,  -- sunyuan | 辛麟芝（仅署名，不做权限控制）
```

**问题**：`better-auth` 会创建 `user` 表，但 `entry.author` 只存名字字符串，无法和 session 里的登录用户关联，会导致"谁写的这条？"只能靠 hardcode 判断。

**建议**：加一个 `user_id TEXT REFERENCES user(id)` 字段，`author` 可保留作展示用的署名，但权限/归属判断走 `user_id`。

---

### 5. 缺少索引定义

没有声明任何索引，而最常见的查询模式都需要索引：

```sql
-- 按类型 + 日期列表：最高频查询
CREATE INDEX idx_entry_type_date ON entry(type, entry_date DESC);

-- 按作者查询
CREATE INDEX idx_entry_author ON entry(author);

-- 软删除过滤
CREATE INDEX idx_entry_deleted ON entry(deleted_at);

-- asset 按 entry 查图片
CREATE INDEX idx_asset_entry_id ON asset(entry_id);
```

D1 是 SQLite，数据量虽小，但没有索引的全表扫描在 Workers 环境下延迟会更明显。

---

### 6. `entry.type` 没有 CHECK 约束

```sql
type  TEXT NOT NULL,  -- diary | message | letter
```

**问题**：可以写入任意字符串，业务层代码很容易出现拼写错误（`"Diary"` vs `"diary"`）。

**建议**：

```sql
type TEXT NOT NULL CHECK(type IN ('diary', 'message', 'letter'))
```

---

### 7. `memo` 表缺少 `created_at` 和 `deleted_at`

```sql
CREATE TABLE memo (
  id         TEXT PRIMARY KEY,
  key        TEXT NOT NULL UNIQUE,
  title      TEXT NOT NULL,
  body       TEXT,
  body_html  TEXT,
  updated_at INTEGER NOT NULL
  -- 缺少 created_at 和 deleted_at
);
```

**问题**：无法知道备忘录是何时创建的，也无法软删除（只能硬删）。

---

### 8. `settings` 缺少 `updated_at`

配置项没有时间戳，无法追溯"纪念日是什么时候改的"这类历史信息。影响不大，但加上成本极低。

---

## 三、设计亮点（保留）

| 设计 | 好在哪里 |
|---|---|
| `entry_date` 与 `created_at` 分离 | 正确区分"事件发生日期"和"写入时间"，时间线场景必须如此 |
| `asset.position` 分数索引（`a0`） | 支持拖拽排序，不用更新所有行 |
| `memo.key` UNIQUE | 用语义化 key 直接查配置，简洁 |
| `id` 用 nanoid | 适合分布式/无主键冲突场景，比自增 ID 更安全 |
| 软删除设计 | entry 保留历史记录，符合日记类应用需求 |
| 4 张表克制 | 没有过度设计，场景匹配 |

---

## 四、修正后的建议 Schema

### `entry`

```sql
CREATE TABLE entry (
  id           TEXT PRIMARY KEY,
  type         TEXT NOT NULL CHECK(type IN ('diary', 'message', 'letter')),
  user_id      TEXT REFERENCES user(id),           -- 新增：关联登录用户
  author       TEXT NOT NULL,                      -- 保留：展示用署名
  title        TEXT,
  body         TEXT,
  body_text    TEXT,                               -- 建议改用 FTS5 虚拟表
  entry_date   INTEGER,
  created_at   INTEGER NOT NULL,
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER
);

CREATE INDEX idx_entry_type_date ON entry(type, entry_date DESC);
CREATE INDEX idx_entry_author    ON entry(author);
CREATE INDEX idx_entry_deleted   ON entry(deleted_at);
```

### `asset`

```sql
CREATE TABLE asset (
  id           TEXT PRIMARY KEY,
  entry_id     TEXT REFERENCES entry(id),
  storage_key  TEXT NOT NULL,                      -- 只存 key，不存完整 URL
  mime_type    TEXT NOT NULL,
  width        INTEGER,
  height       INTEGER,
  size         INTEGER,
  position     TEXT NOT NULL DEFAULT 'a0',
  created_at   INTEGER NOT NULL,
  deleted_at   INTEGER                             -- 新增：软删除
);

CREATE INDEX idx_asset_entry_id ON asset(entry_id);
```

### `memo`

```sql
CREATE TABLE memo (
  id           TEXT PRIMARY KEY,
  key          TEXT NOT NULL UNIQUE,
  title        TEXT NOT NULL,
  body         TEXT,
  created_at   INTEGER NOT NULL,                   -- 新增
  updated_at   INTEGER NOT NULL,
  deleted_at   INTEGER                             -- 新增
);
```

### `settings`

```sql
CREATE TABLE settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at INTEGER NOT NULL                      -- 新增
);
```

---

## 五、优先级汇总

| 优先级 | 问题 |
|---|---|
| 高 | 去掉 `body_html`，改为读时渲染；或明确规定三字段必须同步写入 |
| 高 | `asset.url` 改为运行时拼接，只存 `storage_key` |
| 中 | `asset` 表加 `deleted_at`，entry 软删除时联动 |
| 中 | 补充核心索引（`idx_entry_type_date` 最重要） |
| 低 | `entry.type` 加 CHECK 约束 |
| 低 | `author` 关联 `user_id` |
| 低 | `memo` 补 `created_at` / `deleted_at` |
| 低 | `settings` 补 `updated_at` |
