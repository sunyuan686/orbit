# 电子相册

> 从对象存储浏览全部图片，反查关联内容，支持筛选与安全删除。  
> 进度总览见 [ROADMAP.md](../../ROADMAP.md)（Phase E · 电子相册）。  
> 架构背景见 [ARCHITECTURE.md](../ARCHITECTURE.md)（`asset` 表、R2 / 本地 `data/assets/`）。

---

## 目标

Orbit 的图片散落在日记、时间线、信件等正文中。相册提供独立浏览入口，回答：

- 空间里一共有多少张图？
- 某张图来自哪篇内容？
- 哪些是「上传了但没人引用」的孤儿文件，可以清理？

相册语义是「文章插图库」，不是 Immich 式的私人照片库（无人脸、EXIF、地理编码等）。

---

## 数据源

| 层 | 生产 | 本地开发 |
|----|------|----------|
| 文件全集 | Cloudflare R2 `orbit-media` | `data/assets/` |
| 元数据 / 关联 | D1：`asset`、`entry`、`memo` | SQLite 同上 |

原则：**以存储中的文件对象为全集**；`asset` 表与正文 HTML/Markdown 用于补充关联与排序，不能只看 `asset`（会漏图）。

### 生产数据校验（2026-07-04）

| 指标 | 数量 |
|------|------|
| R2 对象 | 306 |
| D1 `asset`（未删） | 302 |
| `asset` 有 `entry_id` | 302 |
| R2 有、`asset` 无、正文无引用 | 4（`15d3a089.png` 等） |

历史迁移：`migrate-sqlite-to-d1.ts` 导入 `asset`；`migrate-to-r2.sh` 只上传字节，不写 DB。

---

## 关联判定

一张图算「已关联」，满足任一：

1. `asset.entry_id` 指向某 `entry`
2. `entry.body` 含 `/assets/{key}` 或 `assets/{key}`（含 Markdown `![](assets/...)`）
3. `memo.body` 含同上引用

同一 `storage_key` 可被多篇引用（内容寻址去重）；相册展示全部来源。

软删的 `entry` / `memo`：**仍算已关联**；来源链接可跳转，UI 标注「已删除」。

---

## 产品行为

### 入口与页面

- 侧栏独立项：「相册」
- 路由：`/gallery`
- 布局：平铺网格，时间倒序，点击 lightbox 预览

### 筛选

| 值 | 含义 |
|----|------|
| `all` | 全部 |
| `linked` | 已关联 |
| `orphan` | 未关联（R2/磁盘有，且无上述引用） |

### 排序（混合）

1. 若有关联 `entry`：取相关来源中最大的 `entry.entry_date`
2. 否则：`asset.created_at`
3. 再否则：对象上传时间（R2 `uploaded` / 本地 `mtime`）

### 删除

| 条件 | 行为 |
|------|------|
| 正文或 `entry_id` 仍有引用 | 禁止删除，提示被引用处数量 |
| 未关联（孤儿） | 允许删除；双方登录用户均可操作 |
| 删除动作 | 删 R2/本地文件；若存在则软删 `asset.deleted_at` |

不自动从正文摘 `<img>`（避免误伤）；有引用时必须手动改正文后再删。

---

## API

均需登录（与 `/assets/*` 一致）。

### `GET /api/gallery`

查询参数：

| 参数 | 说明 | 默认 |
|------|------|------|
| `filter` | `all` \| `linked` \| `orphan` | `all` |
| `limit` | 1–100 | `48` |
| `offset` | 分页偏移 | `0` |

响应字段（每项）：

```ts
{
  storageKey: string;
  url: string;           // /assets/{storageKey}
  mimeType: string;
  size: number;
  uploadedAt: number;  // Unix 秒
  sortAt: number;      // 用于排序的 Unix 秒
  linked: boolean;
  sources: Array<{
    type: string;      // diary | timeline | message | letter | memo
    id: string;
    title: string | null;
    entryDate: number | null;
    deleted: boolean;
  }>;
}
```

### `DELETE /api/gallery/:storageKey`

- 成功：`{ ok: true }`
- 仍被引用：`400`，`{ error, sources }`
- 不存在：`404`

---

## 实现对照

| 模块 | 路径 |
|------|------|
| 正文 key 解析 | `src/lib/gallery-keys.ts` |
| 索引与列表逻辑 | `src/services/gallery.ts` |
| HTTP 路由 | `src/api/gallery.ts` |
| 本地存储适配 | `src/lib/gallery-local-storage.ts` |
| Worker R2 列表 | `src/worker.ts` → `listAllR2Objects` |
| 前端页面 | `web/src/pages/Gallery.tsx` |

---

## 后续可扩展（未排期）

- 上传/保存正文时同步引用表，减少全量 body 扫描
- 孤儿图延迟 GC（如 30 天）而非即时删
- 按月份分组 UI
- 与首页「精选照片」、IM 入站「相册」共用本 API
