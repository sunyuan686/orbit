# 列表缩略图与封面 Blurhash

> 创建：2026-08-27 ·  
> 状态：已完成

## 目标

列表/网格对已有缩略图的图只请求最长边约 480 的 WebP；条目封面补上 `asset.blurhash`。新上传即时出 thumb；存量用**一次性脚本**补文件（与 blurhash backfill 同类），不上 Images，不做请求期回退。

## 原则

- 相册/拍立得本身就是在翻旧图。只优化新上传，列表体感几乎不变，功能等于没做完。
- 双人空间图量小，一次离线脚本可接受；要幂等：已有 `.w480.webp` 或 `has_thumb=1` 则跳过。
- 没有小文件就不要请求小文件 URL（旧行 `has_thumb=0` 仍走原图，直到脚本成功）。
- 不做 GET 回退（每次列表对缺失 thumb 再读原图）。
- `has_thumb` 在写出成功时置 1（上传或脚本）。

## 约定

- 原图 key 不变：`{8位hash}{ext}`，仍是 `asset.storage_key` 与正文引用的唯一事实。
- 缩略图为旁路对象：`{8位hash}.w480.webp`，**不**插入第二行 `asset` / `asset_reference`。
- GIF/SVG/非图：`has_thumb = 0`，不写旁路文件。
- 列表封面 / 相册网格：`has_thumb = 1` → thumb URL，否则原图 URL。
- 正文 `<img>`、灯箱始终原图。

## 步骤

1. Drizzle：`asset.has_thumb` integer not null default 0；按 `docs/guides/db-migration.md` 出 migration。
2. `thumbStorageKey` / `isThumbStorageKey`（`src/lib/gallery-keys.ts`）。`isImageStorageKey` 与本地列举排除 `.w480.webp`。
3. 上传：同轮出 480 WebP；多写对象；成功则 `has_thumb = 1`。Blurhash 仍对主图编一次。飞书等其它写路径同样处理，失败则保持 0、列表仍用原图。
4. 删除相册对象时成对删原图与 `.w480.webp`。
5. `loadCoversForEntries` 选出 `has_thumb`、`blurhash`、`width`、`height`，按上式拼封面 URL。记忆节点、刮刮卡同样。
6. 拍立得、`CoverImg`、信箱邮票、记忆封面、相册网格走 `GalleryImage`（有 blurhash 则占位）。
7. 一次性脚本（上传通路稳定后）：扫描 `has_thumb=0` 的静图，sharp 写出 `{hash}.w480.webp` 并更新列。本地读 `data/assets/`；生产对齐现有 `db:backfill-blurhash:remote`（R2 + D1）。GIF/失败跳过，不改原图。
8. 更新 `docs/features/005-gallery.md`。

## 不做

- 请求期 GET 回退、Images binding、`GET /api/home`、SW CacheFirst、字体、AI/TipTap 拆包。

## 完成标准（可验证）

- [x] `npm run typecheck` 通过
- [ ] `npm run web:build` 通过（现有 `NotificationBell` 的 `xs` icon 类型错误，与本次无关）
- [x] 新上传：有 `{hash}.w480.webp`，`has_thumb = 1`，列表请求 thumb
- [x] 脚本已提供：`npm run db:backfill-thumbs` / `db:backfill-thumbs:remote`
- [x] 灯箱与正文仍是原图；封面有 blurhash 占位
- [x] 删除原图后旁路 thumb 一并消失；相册不出现缩略图重复项
