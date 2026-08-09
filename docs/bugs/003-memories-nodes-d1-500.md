# Bug #3：恋爱记忆 `GET /api/memories/nodes` 生产 500

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-07-13 |
| 修复日期 | 2026-07-13 |
| 影响范围 | 生产 D1 + Worker；星图 / 图鉴拉节点列表 |
| 相关文件 | `src/services/love-memories.ts`、`src/api/memories.ts` |

## 现象

- 前端 toast：`读取记忆节点失败`
- Network：`GET /api/memories/nodes?limit=400` → **500**
- 同页 `summary`、`milestones` → **200**
- UI 误显示「还没有回忆」（`Promise.all` 整组失败）

## 对照（排障关键）

| 接口 | 行为 | 含义 |
|------|------|------|
| `/summary` | 内部 `listMemoryNodes({ limit: 1 })` | 同查询路径、小批量，作对照 |
| `/nodes?limit=400` | 服务端截断为最多 200，再查封面 | 大批量才炸 |

生产当时约 **298** 条 entry，正文合计约 **71KB**（`max length ≈ 2.5KB`），体量不足以撑爆 Worker。

## 误判

曾怀疑「列表 SELECT 全文 `body_text` → Worker OOM」。对本地/小数据可能成立，**对本事故数据量不成立**。截断正文是合理优化，但不是本次 500 的根因。

## 根因

[D1 单次查询最多 100 个绑定参数](https://developers.cloudflare.com/d1/platform/limits/)。

`loadCoversForEntries` 使用 `inArray(asset.entryId, entryIds)`：limit=200 时一次绑定约 200 个 `?` → D1 直接报错 → 接口 500。

`summary` 只带 1 个 id，参数远低于 100，故一直正常。

`hasCover` 旧实现先拉全部带图 `entry_id` 再 `inArray(entry.id, ids)`，条数一大同样会踩限。

## 修复

1. 封面查询按 **90** 一批分片 `IN`（`D1_IN_CHUNK`）
2. `hasCover` 改为 `EXISTS` 子查询，避免大 `IN` 列表
3. 列表仍用 SQL `substr` + `length`，不拉全文（保留）
4. nodes 500 响应可带 `detail`（异常 message），便于下次对照 Network，不必先开 Observability

## 经验（写 D1 查询时）

- `inArray` / 动态 `IN (?)`：**入参数量必须 ≤ 100**；列表页、封面批量、按 id 集过滤一律按 ≤90 分片，或改 `JOIN` / `EXISTS`
- 生产「A 接口 500、同模块 B 接口 200」时，先比 **limit / IN 长度 / 是否二次大 IN**，不要先猜内存
- 本地 SQLite **没有** 100 参数硬限，此类 bug 本地难复现，必须以 D1 limits 为准
- Workers Observability 未开或 token 无 Analytics 权限时，优先看 Response `detail` + 对照接口

## 验证

部署后：`nodes?limit=400` → 200，星图展示「最近 200/共 298」。
