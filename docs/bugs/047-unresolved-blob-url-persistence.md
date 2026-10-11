# 动态详情页图片丢失（blob 临时地址入库）

> 创建：2026-09-24 ·
> 状态：🟢 已修复

## 现象

用户在生产环境访问动态详情页时（如 `/moment/ent_g1fjt97ywi`），页面仅展示文字，图片缺失；而在列表页（如首页双列卡片瀑布流）中，该动态封面图显示正常。

## 期望行为

- 详情页与列表页均能正常展示插入的图片。
- 本地临时预览地址（`blob:`）严禁作为正文持久化到服务端。
- 上传过程中若用户提前触发保存或退出，系统应正确拦截并等待上传就绪，杜绝半成品数据入库。
- 服务端对任何包含 `blob:` 临时协议的内容进行防御性校验并拒绝写入。

## 根因与修复

### 根因分析
1. **列表有图与详情无图的差异**：
   - 列表卡片封面从 `asset` 表通过 `entry_id` 关联读取。上传接口已将图片保存至 `asset` 表并关联对应 `entryId`，因此列表能够获取封面。
   - 详情页渲染正文 HTML（`entry.body`）。在数据库中，该记录 `body` 中图片标签为 `<img src="blob:https://...">`。`blob:` 是浏览器本地内存临时 URL，离开当前上下文后即失效，导致详情页图片加载失败塌陷。
2. **blob 地址入库原因**：
   - `TiptapEditor` 插入图片时先用 `URL.createObjectURL` 插入 `blobUrl` 供前端即时预览，随后异步上传并预加载原图（原图体积达 4.7MB 耗时较长）。
   - 编辑器未维护上传就绪状态，未向外暴露 `onUploadStateChange`。
   - `ArticleEdit` 保存与草稿自动保存未感知上传状态，保存按钮在上传期间未禁用且无正文协议校验，导致用户在替换完成前触发保存，将临时 `blob:` 存入数据库。

### 修复方案
1. **历史数据修复**：
   - 线上数据库修复 `ent_g1fjt97ywi` 的 `body`，将 `blob:` 替换为 `/assets/bcd15cfe.jpg`，并补全 `asset_reference` 引用。
2. **编辑器上传生命周期管理**：
   - `TiptapEditor` 维护 `activeUploadsCount`，正确触发 `onUploadStateChange` 并通过 handle 暴露 `hasPendingUploads`。
   - 替换正式 URL 时去除无上限的预加载阻塞，加入 1500ms 超时保护。
3. **前端保存拦截**：
   - `ArticleEdit` 与 `EditorFullscreenOverlay` 接入上传状态，当正在上传或正文残留 `blob:` 时禁止提交并给出明确提示，保存按钮显示“上传中…”及禁用态。
4. **服务端终极防御**：
   - `src/api/articles.ts` 在 POST/PUT 时校验，若正文包含 `src="blob:` 直接返回 400，杜绝脏数据入库。

## 回归验证

- [x] 生产数据查询确认 `ent_g1fjt97ywi` 的正文及引用已修复。
- [x] 服务端自动化测试通过：`npm run test`（新增 blob 临时地址拦截测试，60/60 通过）。
- [x] 后端类型校验通过：`npm run typecheck`。
- [x] 前端类型与打包编译通过：`npm run web:build`（tsc -b + vite build）。
