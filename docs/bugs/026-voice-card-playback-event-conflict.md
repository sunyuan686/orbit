# Bug #26：语音卡片播放按钮与全局委托事件互斥导致无法播放修复

| 字段 | 内容 |
|------|------|
| 状态 | 🟢 已修复 |
| 发现日期 | 2026-09-04 |
| 修复日期 | 2026-09-04 |
| 影响范围 | 内容阅读/详情页（`ArticleView.tsx`）及编辑器内的语音卡片播放与转写文稿折叠交互 |
| 相关文件 | `web/src/extensions/OrbitAudio.ts`, `web/src/lib/initVoiceCards.ts` |

## 现象与本质原因

### 1. 现象描述
用户在移动端或桌面端浏览包含录音的日记/文章时：
- 点击语音播放按钮无声、无进度前进，按钮维持播放图标状态（播放失败）；
- 点击语音卡片右侧的「文稿」按钮，文稿区无法正常展开；
- 卡片时间显示正常（例如已正确解析显示 `0:00 / 0:03`），说明音频元数据解码与资源访问完全正常。

### 2. 根因分析（第一性原理）
1. **组件封装破坏与事件冒泡逃逸**：
   TipTap 的 `AudioNodeView`（位于 `OrbitAudio.ts`）在构造时为自身播放按钮直接绑定了 `click` 监听（调用 `this.togglePlay()`）。在调用 `audio.play()` 后，按 HTML 媒体规范 `audio.paused` 会**同步变更为 `false`**。但该监听函数未调用 `e.stopPropagation()`，导致原生点击事件继续沿 DOM 树冒泡至 `document`。
2. **全局事件委托逻辑冲突（打架）**：
   在 `initVoiceCards.ts` 中，全局 `document` 监听了同样的点击事件。当冒泡到达 `document` 时，由于第 1 步中 `audio.paused` 已经变成了 `false`，全局委托误判定为“当前正在播放，用户试图暂停”，随即立刻调用 `audio.pause()`。
3. **播放请求被瞬时 Abort**：
   在同一次微任务事件循环中，音频元素接收到 `play()` 并在几十微秒后接收到 `pause()`，浏览器（尤其是 iOS WebKit）直接抛出 `AbortError: The play() request was interrupted by a call to pause()` 并取消音频解码流，导致用户完全听不到任何声音，按钮也瞬时切回暂停状态。
4. **文稿展开按钮同理互斥**：
5. **Chromium WebM 录音文件缺失 Duration 头部引发 `0:00 / 0:00`**：
   桌面端 Chrome 录制的 WebM 文件采用流式输出，EBML 容器内不含总时长（`duration=N/A`），浏览器加载时原生 `audio.duration` 为 `Infinity`。旧逻辑使用 `total > 0 ? ... : ...`，在 JS 中 `Infinity > 0` 为 `true`，而 `formatTime(Infinity)` 回退为 `"0:00"`，导致总时长显示为 `"0:00"`（即 `0:00 / 0:00` 或 `0:05 / 0:00`），且音波无法按百分比点亮。

---

## 解决方案

从第一性原理出发，彻底理清“组件自包含控制”与“全局 DOM 委托”的职责边界，拒绝胶水代码与二次妥协：

1. **NodeView 交互事件自包含（`OrbitAudio.ts`）**：
   - 彻底移除 `OrbitAudio.ts` 对 `initVoiceCards.ts` 的冗余副作用引用；
   - 在 `AudioNodeView` 的内部操作按钮（`playBtn`、`waveform`、`transcriptToggleBtn`、`editBtn`、`cancelBtn`、`saveBtn`）点击时调用 `e.stopPropagation()`，杜绝内部 DOM 交互事件污染外部全局；
   - 补全 `this.audioEl` 的 `preload = "metadata"` 与播放结束 `ended` 时重置 `currentTime = 0` 的闭环重置逻辑。
2. **全局事件委托建立清晰边界（`initVoiceCards.ts`）**：
   - 全局点击与音频事件增加明确边界守卫：若卡片位于 `.tiptap` 内（即由 `AudioNodeView` 统一托管），全局委托立即短路退出，杜绝多主干重复操作与状态竞态；
   - 补齐 `loadedmetadata` 事件捕获监听，使草稿栏独立卡片亦可即时刷新总时长。
3. **WebM 时长校准引擎与展示防错（`audioUtils.ts`）**：
   - 实现 `resolveAudioDuration`：在 `loadedmetadata` 触发时若 `duration === Infinity`，通过探测最后一帧时间戳实时还原真实时长（在真实用例中毫秒级还原出 10.199 秒）；
   - 展示层强化类型判断：严格校验 `isFinite(total) && total > 0`，未获取到有效有限总时长前绝不显示 `/ 0:00`；
   - 录制上传链路透传：`VoiceNoteRecordButton.tsx` 录制完成时将秒级时长持久化提交至后端数据库 `asset.duration`。

---

## 回归验证

- `npm run typecheck` 0 错误；
- `npm run web:build` 编译打包 0 错误；
- 详情页内点击播放按钮正常播放与暂停，音波与时间高亮同步推进；
- 详情页内点击「文稿」按钮正常展开与折叠；
- 发帖弹窗草稿栏附件播放与文稿折叠不受任何影响；
- WebM 语音卡片时间由 `0:00 / 0:00` 准确校准为真实总时长（如 `0:05 / 0:10`），音波进度百分比同步点亮。
