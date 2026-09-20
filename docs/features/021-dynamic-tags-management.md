# 动态标签管理与单一数据源

> 创建：2026-09-06 · 
> 状态：已完成

## 背景与目标

解决前端标签硬编码、无法动态增删改标签名以及标签来源不统一的问题。通过建立独立的 `tags` 实体数据表与统一的数据流，支持用户在筛选与新建动态时就地化管理标签。

## 交互与界面

1. **就地化管理触点**：
   - **筛选时**：动态首页顶部工具栏「标签」下拉菜单底部提供「管理标签...」操作。
   - **新建/编辑时**：快捷发布抽屉及全屏编辑器的标签栏末尾提供「+」小胶囊。
2. **标签管理弹窗 (TagManageModal)**：
   - 展示现有标签列表，显示名称、色系预览、关联动态数量统计。
   - 支持就地重命名标签（底层稳定 ID 不变，历史动态瞬间平滑展示为新名称）。
   - 支持删除标签（支持确认，历史动态中性降级展示）。
   - 新增标签：输入名称并从 6 种雅致色系（amber、rose、sky、emerald、indigo、violet）中单选。若在发布面板中新增，创建后自动选中该标签。
3. **单一数据源消费**：
   - 首页筛选下拉、底栏发布抽屉、全屏编辑器、动态卡片徽章统一由 `useMomentTags` Hook 驱动，消除所有代码硬编码。

## 数据模型

```typescript
export const tags = sqliteTable(
  "tags",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    color: text("color").notNull().default("amber"),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: integer("created_at").notNull().default(sql`(unixepoch())`),
    updatedAt: integer("updated_at").notNull().default(sql`(unixepoch())`),
  },
  (t) => [
    index("idx_tags_sort").on(t.sortOrder, t.createdAt),
  ]
);
```

初始种子数据：
- `('milestone', '足迹', 'amber', 1)`
- `('appreciation', '感谢', 'rose', 2)`
- `('message', '留言', 'sky', 3)`

## 回归验证

1. 数据库迁移安全执行且自动快照；
2. `/api/tags` CRUD 与聚合条数接口单元测试通过；
3. 动态列表筛选标签与发布面板标签均来自 API；
4. 修改标签名后，历史动态卡片显示即刻变更。
