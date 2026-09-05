# Bug #25：关于页面「清除缓存」行移动端异常折行与对齐错位治理

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-09-04 |
| 修复日期 | 2026-09-04 |
| 影响范围 | 设置 -> 关于页面 (`AboutSettingsPanel.tsx`) 移动端与桌面端排版一致性 |
| 相关文件 | `web/src/components/AboutSettingsPanel.tsx`, `web/src/index.css` |

## 现象与本质原因

### 1. 现象描述
在窄屏（$\le 640\text{px}$）或手机端 PWA 下，打开「设置 -> 关于」：
- 第一行「版本」与第三行「运行环境」保持左右两端水平对齐，操作按钮紧凑对齐在卡片右边缘；
- 第二行「缓存」却异常折行成纵向两行：上方为「缓存」标签，下方靠左放置「清除缓存」按钮，整行右侧出现大面积空缺断层，视觉上极不协调。

### 2. 根因分析
1. **死代码遗留干扰**：历史提交中曾考虑为缓存操作配备长说明文案并增加了 `.orbit-settings-info-row--stackable` 类及对应响应式样式；随后文案被精简，但该类名未被同步移除。
2. **断点行为与内容特征失配**：当视口宽度 $\le 640\text{px}$ 时，`.orbit-settings-info-row--stackable` 强行切换为纵向布局（`flex-direction: column; align-items: flex-start`），导致仅有 2 个汉字标签与 1 个小按钮的「缓存」行被意外纵向拉伸，破坏了整体卡片的对齐节奏。

---

## 解决方案

1. **统一行结构与对齐语义**：
   - 彻底移除 `AboutSettingsPanel.tsx` 中缓存行上的 `orbit-settings-info-row--stackable` 及冗余的 flex 包装标签；
   - 恢复与「运行环境」一致的扁平语义结构：左侧为 `.orbit-settings-info-label`（「缓存」），右侧为 `.orbit-settings-info-value.shrink-0`（「清除缓存」按钮）。
2. **操作区防收缩强化**：
   - 为第二行和第三行的 `.orbit-settings-info-value` 均补全 `shrink-0`，确保与第一行一致，在极端窄屏下右侧按钮绝对不会被挤压形变。
3. **彻底清理无用 CSS**：
   - 从 `web/src/index.css` 中完全清理 `.orbit-settings-info-row--stackable` 规则，不留死代码与兜底胶水代码。

---

## 回归验证

- `npm run typecheck` 0 错误；
- `npm run web:build` 编译与 PWA Service Worker 生成成功（0 错误）；
- 移动端（$\le 640\text{px}$）与桌面端下，「版本」、「缓存」、「运行环境」三行均保持左右两端标准对齐，右侧各操作按钮垂直对齐工整。
