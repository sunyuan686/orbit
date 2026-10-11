# 相册照片关联应用来源展示

> 创建：2026-10-07 · 状态：进行中

## 背景与目标

在相册查看大图时，用户期望清晰感知该照片与哪个应用功能（动态/时光、信箱/慢信）相关联，并支持便捷点击跳转直达内容详情，打通相册与核心内容资产的互联。

## 交互与界面

- **温和克制的来源标签**：在大图卡片底部（`PhotoLightbox` 元信息区），若照片存在内容引用，以符合 Design Token 的典雅小胶囊展示来源：
  - 动态：`动态 · YYYY-MM-DD` 或带有标题
  - 信件：`信箱 · 标题`
- **一键直达**：点击标签可关闭灯箱并导航至对应动态或信件详情；
- **视觉风格**：遵循 [DESIGN.md](DESIGN.md) 60-30-10 法则与三元字体体系，使用次级文字颜色、中性边框、Mono 等宽时间，克制典雅，不喧宾夺主。

## 数据流转

- 后端 `GET /api/albums/:id` 在返回相片流时，通过 `loadSourcesForKeys` 批量附加 `sources: GallerySource[]`（包含 `type`、`id`、`title`、`entryDate`）；
- 前端 `PhotoLightbox` 接收并在底部元信息区优雅呈现，支持路由跳转。

## 回归验证

- [x] 后端 API（`GET /api/albums/:id`）通过 `loadSourcesForKeys` 高效返回每张照片关联的 `sources` 列表；
- [x] 大图预览（`PhotoLightbox`）底部元信息区遵循 [DESIGN.md](DESIGN.md) 典雅呈现来源小胶囊（支持动态 `MomentIcon` 与信箱 `LetterIcon`）；
- [x] 点击来源标签优雅通过 `replace: true` 导航至对应内容详情，无历史幽灵条目；
- [x] 第一性原理消除白屏与刷新感：
  - 次级视口容器 `.orbit-subpage-viewport` 补齐 `bg-[var(--color-bg)]` 纯净画布底色，消除移动端透明过渡漏洞；
  - 根 Shell 预加载队列补充 `AlbumDetail` chunk，消除回退时的异步拉取等待；
  - 优化照片网格渲染，无占位图节点时立即呈现 `opacity: 1`，避免缓存图片被强制延迟 250ms 淡入引发的空白闪烁；
- [x] 没有任何关联的独立照片保持纯净留白，不显示冗余占位；
- [x] 前端类型检查 `npm run web:build` 与 `npm test`（60/60 项）全量通过；
- [ ] 用户真机体验确认。
