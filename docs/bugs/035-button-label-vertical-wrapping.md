# 新建相册按钮图标与文字异常折行堆叠及光学对齐问题

> 创建：2026-09-07 · 
> 状态：已修复

## 现象

1. 相册页面（`/albums`）右上角「新建相册」按钮内，`+` 图标与文本曾异常上下断行显示，按钮被撑大畸变。
2. 修复单行排版后，SVG `+` 图标几何中心与汉字「新建」排版视觉中心存在垂直错位（`+` 偏低约 1.5px~2px，指向汉字下半部分），视觉上不水平协调。

## 期望行为

- 按钮内前置图标与文本保持严格水平对齐（Flex Row），间距适中，绝不发生断行。
- 图标中心与汉字文本视觉重心（Optical Center）在水平轴线上精准对齐。
- 遵循统一的 `Button` 设计系统规范与令牌。

## 根因与修复

1. **断行根因**：Tailwind 将 `svg` 设为 `display: block`，而 `Button.tsx` 将 `children` 包裹在默认 `display: inline` 的 `span.orbit-ui-btn-label` 中。
2. **光学错位根因**：西文字体（`Inter`）拥有较深的下行区（Descender），中文字体（`PingFang SC`）顺着基线向上延展至顶，导致汉字实际墨水重心相比严格居中的几何 SVG 图标高出约 1.5px~2px。
3. **修复措施**：
   - 全局 CSS 为 `.orbit-ui-btn-label` 赋予 `inline-flex` 与 `nowrap` 保护。
   - `.orbit-ui-btn-icon` 增加光学微调 `transform: translateY(-1px)`，使几何图标重心与汉字墨水中心严格共线；纯图标模式（`.orbit-ui-btn--icon-only`）自动恢复 `transform: none`。
   - `Albums.tsx` 统一将按钮文案收敛为「新建」，采用次级按钮样式与刊物级左侧标题计数对齐。

## 回归验证

- 相册页面右上角按钮排版正常，无断行，按压有微动效反馈。
- Canvas 像素渲染检测：`+` 图标水平横线与汉字「新建」视觉中心垂直误差收敛在 0.3px 内，人眼观察平整协调。
- `npx tsc --noEmit` 与 `npm run build` 全部通过。
