# Bug #11：富文本编辑器与正文排版（Prose Typography）垂直节奏与段间距系统性优化

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-08-31 |
| 修复日期 | 2026-08-31 |
| 影响范围 | 全站富文本编辑（`ArticleEdit` / Note 随想）、文章阅读详情页（`ArticleView` / 全屏阅读） |
| 相关文件 | `web/src/index.css` |

## 现象与本质原因

用户反馈在 Web 端与 PWA 移动端下，编辑和查看内容时文字间距明显过宽，排版极其松散。

深入核实排版引擎（Tiptap/ProseMirror）与样式系统发现：

### 1. 固定段落底边距过大（Paragraph Margin Antipattern）
- **根因**：原规则 `.orbit-prose p, .ProseMirror p { margin: 0 0 0.9rem; }` 使用了高达 `0.9rem`（14.4px）的固定外边距。用户每按一次 <kbd>Enter</kbd> 换行都会生成一个新的 `<p>` 段落；在 `1.72` 正文行高（上下 leading 各约 5.5px）的叠加下，相邻两行短句之间的垂直净空白高达 **25.4px**（超出字号本身 60% 以上）。在写短日记、诗歌或单句换行时，视觉上如同空了一整行。

### 2. 块级垂直节奏与字号脱节（Non-modular Block Spacing）
- **根因**：段落、列表、标题和引用块使用了脱离当前字号的固定 `rem`，导致当用户在设置中切换字阶（普通/适中/大字）时，间距无法成比例自适应缩放。

### 3. 首尾元素外边距泄露（First/Last Child Margin Leak）
- **根因**：容器内第一个元素和最后一个元素自带的上下外边距导致编辑器与阅读卡片内部留白不均。

---

## 解决方案（W3C CLREQ 中文排版最佳实践）

1. **相对字号的段间距体系 (`margin-bottom: 0.45em`)**：
   - 将 `.orbit-prose p, .ProseMirror p` 的底边距重构为 `margin: 0 0 0.45em;`（约 6.75px ~ 7.8px，为字号的 45%）；
   - 保证多行短句换行凝聚紧凑自然，长段落之间依然具有清晰的段落区分与呼吸感。
2. **块级垂直节奏标尺升级**：
   - 标题 `h1 ~ h4`：`margin-top: 1.4em ~ 1.1em`，`margin-bottom: 0.45em ~ 0.3em`；
   - 列表 `ul, ol`：`margin: 0.4em 0 0.8em; li { margin-bottom: 0.2em; }`；
   - 引用 `blockquote` 与代码块 `pre`：`margin: 0.8em 0;`。
3. **首尾外边距规整与字距继承**：
   - 增加 `.orbit-prose > :first-child { margin-top: 0 !important; }` 与 `.orbit-prose > :last-child { margin-bottom: 0 !important; }`；
   - 显式声明 `letter-spacing: var(--tracking-body, 0.01em);`。

---

## 验证闭环

- `npm run build` 打包构建 100% 通过（零错误零警告）；
- 连续短句输入（如「我难过 \n 我不开心 \n 我想睡觉」）行距紧凑凝聚，无空行假象；
- 编辑态与阅读态排版 100% 所见即所得；
- 字号缩放自适应完美。
