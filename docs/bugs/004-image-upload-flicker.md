# Bug #4：写作上传图片后页面闪烁

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-07-14 |
| 修复日期 | 2026-07-14 |
| 影响范围 | 写作页（`ArticleEdit` / TipTap），工具栏插入、粘贴、拖拽图片 |
| 相关文件 | `web/src/components/TiptapEditor.tsx` |

## 现象

上传图片完成后，编辑区出现一次刷新式闪烁（非整页 reload）。

## 根因

`uploadImageToEditor` 先用 `blob:` 预览，上传成功后立刻 `setNodeMarkup` 换成服务端 URL。浏览器此时重新拉图，中间空白一帧，表现为闪白。

另：粘贴 / 拖拽路径在调用 `uploadImageToEditor` 前又多插了一次 blob 图，会插入两张。

非整页 remount：`ArticleEdit` 的 `onChange` 只写 `bodyRef`，上传不触发导航。

## 修复

1. 上传成功后先 `new Image()` 预加载正式 URL，再替换 blob `src`
2. 粘贴 / 拖拽只走 `uploadImageToEditor`，去掉重复插入

## 验证

写作页插入 / 粘贴 / 拖拽图片，上传完成后预览连续，无闪白、无双图。
