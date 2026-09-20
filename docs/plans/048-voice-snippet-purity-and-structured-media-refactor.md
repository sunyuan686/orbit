# 语音正文纯净提取与结构化媒体解耦施工计划

> 创建：2026-09-09 · 
> 状态：进行中

## 目标

彻底解决富文本中音频卡片提取摘要时泄露播放器 UI 控件文本（`0:00`、`💬文稿`）及硬编码拼接 `🎙️ [语音]` 的问题：
1. **源头纯净化**：在 `plain-text.ts` 中通过字符级标签深度状态机，精准跨过包含控件的音频卡片 DOM 结构，只提取纯净的人类转写文稿 `transcript`，零正则、零修饰字符；
2. **结构化媒体属性**：在 API 层（`src/api/articles.ts`）与接口类型定义中提供 `hasAudio: boolean` 字段，替代前端字符串嗅探；
3. **彻底删除嗅探胶水**：前端 `MomentCard.tsx` 直接依赖 `entry.hasAudio` 渲染徽章，正文摘要只呈现纯文本；
4. **存量数据一次性回填**：运行 `scripts/backfill-body-text.ts` 重新写入历史记录的 `body_text` 并重建 FTS。

## 步骤

1. 改造 `src/lib/plain-text.ts`：
   - 使用 `depth` 计数精准匹配外层闭合 `</div>`，彻底跳过子节点所有播放器控件；
   - 移除 `🎙️ [语音]` 硬拼接字符串，仅输出干净文稿。
2. 改造 `src/api/articles.ts` 与 `web/src/lib/api.ts`：
   - 增加 `hasAudio` 字段，由 SQL 原生逻辑生成并输出到 `EntrySummary`。
3. 改造 `web/src/components/MomentCard.tsx`：
   - 彻底删除 `snippet.includes("🎙️")` 等胶水嗅探代码，直接读取 `entry.hasAudio`。
4. 编写回归测试 `tests/plain-text.test.ts`，验证多种音频 DOM 与普通富文本提取纯净度。
5. 运行 `npx tsx scripts/backfill-body-text.ts` 回填数据库历史数据。
6. 验证自动化测试、类型检查与前端构建。

## 完成标准（可验证）

- [ ] `toPlainText` 正确跳过播放器内全部子标签（`orbit-voice-waveform`、`0:00`、`文稿` 按钮等），只提取文稿纯文本
- [ ] 提取文本中没有任何 `🎙️ [语音]` 等伪字符
- [ ] API `GET /api/articles` 返回项包含准确的 `hasAudio` 布尔值
- [ ] 数据库历史记录全部刷新为纯净文本，FTS 索引重建成功
- [ ] `npm test`、`npm run typecheck`、`npm run build --prefix web` 零错误通过
